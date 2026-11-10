"""분석 워커: Redis 대기열(malang:jobs)에서 작업을 받아 PostgreSQL에 결과를 쓴다.

작업 형식 (JSON): {"type": "attempt", "id": "<attempt uuid>"} | {"type": "listen_answer", "id": "<answer uuid>"}
결과를 쓴 뒤 PUBLISH malang:attempt:<id> 로 API에 알린다.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import signal
import time
import traceback

import numpy as np
import psycopg
import redis
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from psycopg.types.json import Jsonb

from . import align as al
from . import script as sc
from .audio import load_wav
from .pipeline import analyze, analyze_mic_check
from .pronounce import standard_pronunciation
from .recognizer import get_recognizer

log = logging.getLogger("malang.worker")
QUEUE = os.environ.get("JOB_QUEUE", "malang:jobs")


def _key() -> bytes:
    key = base64.b64decode(os.environ["RECORDING_KEY"])
    if len(key) != 32:
        raise RuntimeError("RECORDING_KEY must be 32 bytes (base64)")
    return key


def read_recording(storage_key: str) -> bytes:
    root = os.environ.get("STORAGE_DIR", "./storage")
    path = os.path.join(root, storage_key)
    blob = open(path, "rb").read()
    iv, rest = blob[:12], blob[12:]  # [IV 12][암호문][태그 16]
    return AESGCM(_key()).decrypt(iv, rest, None)


def _db_url() -> str:
    url = os.environ["DATABASE_URL"]
    return url.split("?")[0]


def process_attempt(conn: psycopg.Connection, attempt_id: str) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE "Attempt" SET status='PROCESSING' WHERE id=%s AND status IN ('QUEUED','PROCESSING')
               RETURNING "userId", "targetText", "targetPronunciation", context, "recordingId", "itemId" """,
            (attempt_id,),
        )
        row = cur.fetchone()
        conn.commit()
        if not row:
            return "skipped"
        user_id, text, pron, context, rec_id, item_id = row
        cur.execute('SELECT "storageKey" FROM "Recording" WHERE id=%s AND "deletedAt" IS NULL', (rec_id,))
        rec = cur.fetchone()
        cur.execute('SELECT baseline, calibration FROM "User" WHERE id=%s', (user_id,))
        baseline, calibration = cur.fetchone() or (None, None)
        kind, sounds, exercise, intonation = "WORD", [], None, None
        if item_id:
            cur.execute('SELECT kind, "targetSounds", exercise, intonation FROM "LessonItem" WHERE id=%s', (item_id,))
            it = cur.fetchone()
            if it:
                kind, sounds, exercise, intonation = it[0], list(it[1] or []), it[2], it[3]
        cur.execute('SELECT count(*) FROM "Attempt" WHERE "userId"=%s', (user_id,))
        seed = int(cur.fetchone()[0])

    if not rec:
        _finish(conn, attempt_id, "FAILED", None, None, None, None, "recording_missing")
        return "FAILED"

    x = load_wav(read_recording(rec[0]))
    if context == "MIC_CHECK":
        res = analyze_mic_check(x)
        status = "DONE" if res["quality"]["ok"] else "ISSUE"
        with conn.cursor() as cur:
            if status == "DONE":
                cur.execute('UPDATE "User" SET baseline=%s WHERE id=%s', (Jsonb(res["baseline"]), user_id))
        _finish(conn, attempt_id, status, res, None, None, res["quality"]["issue"], None)
        return status

    res = analyze(x, text, pron or None, kind, sounds, baseline, seed, exercise, intonation, calibration)
    issue = res["quality"]["issue"]
    status = "ISSUE" if issue else "DONE"
    _finish(conn, attempt_id, status, res, res["heard"], res["passed"], issue, None, res.get("model"))
    return status


def _finish(conn, attempt_id, status, result, heard, passed, issue, error, model=None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE "Attempt" SET status=%s, result=%s, heard=%s, passed=%s, issue=%s, error=%s,
               "modelVersion"=%s, "analyzedAt"=now() WHERE id=%s""",
            (status, Jsonb(result) if result is not None else None, heard, passed, issue, error, model, attempt_id),
        )
    conn.commit()


def process_listen_answer(conn: psycopg.Connection, answer_id: str) -> str:
    """듣는 사람 받아쓰기를 정답과 같은 방식으로 비교 (사람 귀 vs 앱)."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT la."answerText", la.unsure, a."targetPronunciation", a."targetText"
               FROM "ListenAnswer" la JOIN "ListenLinkItem" li ON li.id = la."linkItemId"
               JOIN "Attempt" a ON a.id = li."attemptId" WHERE la.id=%s""",
            (answer_id,),
        )
        row = cur.fetchone()
        if not row:
            return "skipped"
        text, unsure, pron, target = row
        if unsure or not text:
            result = {"heardPronunciation": None, "phonemes": None, "unsure": True}
        else:
            hp = standard_pronunciation(text)
            result = {"heardPronunciation": hp, "phonemes": al.compare(pron or standard_pronunciation(target), hp), "unsure": False}
        cur.execute('UPDATE "ListenAnswer" SET result=%s WHERE id=%s', (Jsonb(result), answer_id))
    conn.commit()
    return "DONE"


def process_script_extract(conn: psycopg.Connection, doc_id: str) -> str:
    with conn.cursor() as cur:
        cur.execute('SELECT "storageKey", "sourceType" FROM "ScriptDoc" WHERE id=%s', (doc_id,))
        row = cur.fetchone()
        if not row or not row[0]:
            return "skipped"
        key, source = row
        try:
            slides = sc.extract(read_recording(key), source)
            slides = [s for s in slides if s["text"]]
            if not slides:
                raise RuntimeError("글자를 찾지 못했어요")
            chars = sum(len(s["text"]) for s in slides)
            cur.execute('UPDATE "ScriptDoc" SET status=\'READY\', slides=%s, "charCount"=%s, "storageKey"=NULL, error=NULL WHERE id=%s', (Jsonb(slides), chars, doc_id))
            status = "READY"
        except Exception as e:
            cur.execute('UPDATE "ScriptDoc" SET status=\'FAILED\', error=%s, "storageKey"=NULL WHERE id=%s', (str(e)[:300], doc_id))
            status = "FAILED"
    # 원본 파일은 글을 뽑은 뒤 바로 지운다 (원고는 비교에만)
    try:
        os.remove(os.path.join(os.environ.get("STORAGE_DIR", "./storage"), key))
    except OSError:
        pass
    return status


def process_script_run(conn: psycopg.Connection, run_id: str) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE "ScriptRun" r SET status='PROCESSING' FROM "ScriptDoc" d WHERE r.id=%s AND d.id=r."docId" AND r.status IN ('QUEUED','PROCESSING')
               RETURNING r."storageKey", r."slideFrom", r."slideTo", r."freeSpeech", d.slides""",
            (run_id,),
        )
        row = cur.fetchone()
        if not row:
            return "skipped"
        key, a, b, free, slides = row
        try:
            x = sc.decode_any(read_recording(key))
            chosen = [s for s in (slides or []) if a <= s["n"] <= b]
            res = sc.analyze_run(x, chosen, free)
            cur.execute('UPDATE "ScriptRun" SET status=\'DONE\', result=%s, "durationMs"=%s, "analyzedAt"=now(), error=NULL WHERE id=%s', (Jsonb(res), int(res["durationSec"] * 1000), run_id))
            return "DONE"
        except Exception as e:
            log.error("script run failed: %s", traceback.format_exc())
            cur.execute('UPDATE "ScriptRun" SET status=\'FAILED\', error=%s, "analyzedAt"=now() WHERE id=%s', (str(e)[:300], run_id))
            return "FAILED"


def process_calibrate(conn: psycopg.Connection, user_id: str) -> str:
    """내 목소리에 맞추기: 내가 맞게 낸 모음 녹음들의 위치(F1·F2) 평균을 개인 기준으로 저장한다.
    (음성 인식 모델 재학습이 아니라, 모음 지도 목표 칸을 내 목소리에 맞추는 개인 보정)"""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT result->'vowelPoint' FROM "Attempt" WHERE "userId"=%s AND status='DONE' AND result ? 'vowelPoint'
               AND result->'vowelPoint'->>'target' IS NOT NULL AND result->'vowelPoint'->>'target' = result->'vowelPoint'->>'nearest'""",
            (user_id,),
        )
        pts: dict[str, list[tuple[float, float]]] = {}
        for (vp,) in cur.fetchall():
            pts.setdefault(vp["target"], []).append((vp["f1"], vp["f2"]))
        vowels = {k: [round(float(np.median([p[0] for p in v]))), round(float(np.median([p[1] for p in v])))] for k, v in pts.items() if len(v) >= 3}
        cur.execute('SELECT count(*) FROM "Attempt" WHERE "userId"=%s AND status=\'DONE\'', (user_id,))
        n = cur.fetchone()[0]
        cal = {"vowels": vowels or None, "samples": {k: len(v) for k, v in pts.items()}, "recordings": n, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        cur.execute('UPDATE "User" SET calibration=%s WHERE id=%s', (Jsonb(cal), user_id))
    return "DONE"


def requeue_stuck(conn: psycopg.Connection, r: redis.Redis) -> None:
    with conn.cursor() as cur:
        cur.execute("""SELECT id FROM "Attempt" WHERE status IN ('QUEUED','PROCESSING') AND "createdAt" > now() - interval '1 day'""")
        for (aid,) in cur.fetchall():
            r.rpush(QUEUE, json.dumps({"type": "attempt", "id": str(aid)}))
        cur.execute("""SELECT id FROM "ScriptRun" WHERE status IN ('QUEUED','PROCESSING') AND "createdAt" > now() - interval '1 day'""")
        for (rid,) in cur.fetchall():
            r.rpush(QUEUE, json.dumps({"type": "script_run", "id": str(rid)}))
        cur.execute("""SELECT id FROM "ScriptDoc" WHERE status='EXTRACTING' AND "createdAt" > now() - interval '1 day'""")
        for (did,) in cur.fetchall():
            r.rpush(QUEUE, json.dumps({"type": "script_extract", "id": str(did)}))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    r = redis.Redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"))
    conn = psycopg.connect(_db_url(), autocommit=True)  # 문장마다 커밋: 건너뛴 작업이 트랜잭션을 붙잡지 않게
    rec = get_recognizer()
    log.info("recognizer: %s", rec.name if rec else "UNAVAILABLE (ASR_MODEL_DIR not set)")
    requeue_stuck(conn, r)
    running = {"on": True}
    signal.signal(signal.SIGTERM, lambda *_: running.update(on=False))
    log.info("worker ready, waiting on %s", QUEUE)
    while running["on"]:
        item = r.brpop(QUEUE, timeout=2)
        if not item:
            continue
        job = json.loads(item[1])
        t0 = time.time()
        try:
            if job["type"] == "attempt":
                status = process_attempt(conn, job["id"])
            elif job["type"] == "listen_answer":
                status = process_listen_answer(conn, job["id"])
            elif job["type"] == "script_extract":
                status = process_script_extract(conn, job["id"])
            elif job["type"] == "script_run":
                status = process_script_run(conn, job["id"])
            elif job["type"] == "calibrate":
                status = process_calibrate(conn, job["id"])
            else:
                status = "unknown"
        except Exception as e:  # 실패를 기록하고 다음 작업으로
            conn.rollback()
            log.error("job failed %s: %s", job, traceback.format_exc())
            status = "FAILED"
            if job.get("type") == "attempt":
                _finish(conn, job["id"], "FAILED", None, None, None, None, str(e)[:500])
        log.info("job %s %s -> %s (%.2fs)", job.get("type"), job.get("id"), status, time.time() - t0)
        r.publish(f"malang:{job.get('type')}:{job.get('id')}", json.dumps({"status": status}))


if __name__ == "__main__":
    main()
