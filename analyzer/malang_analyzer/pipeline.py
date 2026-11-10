"""분석 6단계: ① 녹음 검사 ② 음성 인식 ③ 정답 소리 ④ 정렬 비교 ⑤ 측정 ⑥ 피드백"""
from __future__ import annotations

import numpy as np

from . import align as al
from . import audio as au
from . import feedback as fb
from .pronounce import phonemes, standard_pronunciation, syllable_texts
from .recognizer import get_recognizer

HISS_SOUNDS = {"ㅅ", "ㅆ"}
VOWEL_ONLY = set("아어오우으이에애야여요유와워의")


def _hangul_only(s: str) -> str:
    return "".join(ch for ch in s if "가" <= ch <= "힣" or ch == " ").strip()


def analyze_mic_check(x: np.ndarray) -> dict:
    """기준 목소리: 평소 목소리 '아——' 3초. 크기·높이·울림을 저장."""
    q = au.quality(x)
    start, end = q["region"]
    p = au.pitch_stats(x)
    baseline = {
        "intensityDb": au.intensity_db(x, start, end),
        "pitchHz": p["medianHz"],
        "formants": au.formants(x, start, end),
        "resonanceDb": au.resonance(x, start, end),
        "durationSec": q["speechSec"],
        "noiseDb": q["noiseDb"],
    }
    return {"quality": q | {"region": None}, "baseline": baseline, "passed": None, "heard": None}


def analyze(
    x: np.ndarray,
    target_text: str,
    target_pron: str | None,
    kind: str,
    target_sounds: list[str],
    baseline: dict | None,
    seed: int = 0,
    exercise: str | None = None,
    intonation: str | None = None,
    calibration: dict | None = None,
) -> dict:
    target_pron = target_pron or standard_pronunciation(target_text)
    # ① 녹음 검사
    q = au.quality(x)
    region = q.pop("region")
    q["region"] = None
    result: dict = {
        "target": target_text,
        "targetPronunciation": target_pron,
        "quality": q,
        "heard": None,
        "heardPronunciation": None,
        "phonemes": None,
        "soundVerdicts": None,
        "measures": None,
        "voice": None,
        "feedback": None,
        "passed": None,
        "model": None,
        "limits": [],
    }
    if not q["ok"]:
        result["feedback"] = fb.build(None, q["issue"], target_sounds, seed)
        return result

    # ② 음성 인식 — 보정 없이 그대로
    rec = get_recognizer()
    heard = None
    if exercise in NONWORD_EXERCISES:
        # "음——" · "스—" 같은 소리 연습은 글자 비교 대신 소리 자체만 잰다
        rec = None
        result["limits"].append("sound_only_exercise")
    elif rec is None:
        result["limits"].append("recognizer_unavailable")
    else:
        r = rec.recognize(x)
        result["model"] = r.model
        heard = _hangul_only(r.text) or None
        result["heard"] = r.text.strip() or None
        result["limits"].append("word_level_asr")  # 받아쓰기 모델이라 실제 단어 쪽으로 기울 수 있음

    # ③ 정답 소리 · ④ 정렬 비교
    heard_pron = standard_pronunciation(heard) if heard else None
    result["heardPronunciation"] = heard_pron
    cmp = al.compare(target_pron, heard_pron) if rec is not None else None
    if cmp:
        result["phonemes"] = cmp
        result["soundVerdicts"] = al.sound_verdicts(cmp["ops"], target_sounds)
        if cmp["diffRatio"] is not None and cmp["diffRatio"] > 0.5:
            q["issue"] = "mismatch"
        elif cmp["diffRatio"] is not None:
            verdicts = [v for v in result["soundVerdicts"].values() if v is not None]
            result["passed"] = bool(verdicts) and all(verdicts) if target_sounds else cmp["matched"] == cmp["total"]

    # ⑤ 측정
    syl_count = len(syllable_texts(target_pron))
    wants_hiss = any(s in HISS_SOUNDS for s in target_sounds) or any(p.symbol in HISS_SOUNDS for p in phonemes(target_pron)) or exercise == "hiss"
    vowels_in = [p.symbol for p in phonemes(target_pron) if p.pos == "vowel"]
    wants_formant = (kind == "SYLLABLE" and target_text in VOWEL_ONLY) or any(v in VOWEL_SOUND_TARGETS for v in target_sounds)
    q["region"] = region
    m = au.measure(x, q, kind, syl_count, wants_hiss, wants_formant)
    q["region"] = None
    m["shape"] = au.shape(x)
    sylls = au.syllable_nuclei(x, *region) if region[0] is not None else []
    m["syllables"] = sylls
    result["measures"] = m
    result["voice"] = au.compare_voice(m, baseline)
    result["exercise"] = evaluate_exercise(exercise or _auto_exercise(kind, intonation), target_pron, m, sylls, region, x, baseline, intonation)
    # 확실하지 않음: 글자 길이가 0.07초보다 짧으면 그 글자의 소리는 맞다·틀리다를 정하지 않는다 (Uncertain)
    if cmp and result["exercise"] and result["exercise"].get("aligned"):
        short = {i for i, sy in enumerate(sylls) if sy["dur"] < 0.07}
        if short:
            for o in cmp["ops"]:
                if o["target"] and o["target"]["syl"] in short and o["type"] == "sub":
                    o["type"] = "unsure"
            result["soundVerdicts"] = al.sound_verdicts(cmp["ops"], target_sounds)
    # 소리를 직접 재서 받아쓰기 결과를 교차 확인 (받아쓰기가 아는 단어로 맞춰 적는 문제 완화)
    if cmp:
        checks = acoustic_checks(cmp["ops"], m.get("hiss"), target_pron)
        if checks:
            result["acousticChecks"] = checks
            result["soundVerdicts"] = al.sound_verdicts(cmp["ops"], target_sounds)
            verdicts = [v for v in result["soundVerdicts"].values() if v is not None]
            if result["passed"] is not None:
                result["passed"] = (bool(verdicts) and all(verdicts)) if target_sounds else all(o["type"] in ("same", "allowed") for o in cmp["ops"] if o["target"])
                if target_sounds and not verdicts:
                    result["passed"] = None
    if m.get("formants") and m["formants"].get("f1"):
        which = au.vowel_set(baseline)
        f1, f2 = m["formants"]["f1"], m["formants"]["f2"]
        goal = next((v for v in target_sounds if v in VOWEL_SOUND_TARGETS), vowels_in[0] if vowels_in else None)
        personal = (calibration or {}).get("vowels") or {}
        # 내 목소리에 맞춘 모음은 그 모음만 바꾸고, 나머지는 기본 평균을 쓴다
        targets = {**{k: list(v) for k, v in au.VOWEL_TARGETS[which].items()}, **{k: list(v) for k, v in personal.items()}}
        result["vowelPoint"] = {
            "f1": f1, "f2": f2, "target": goal, "nearest": nearest_in(f1, f2, targets),
            "targets": targets, "set": "personal" if personal else which,
        }

    # ⑥ 피드백
    issue = q["issue"] if q["issue"] == "mismatch" else None
    result["feedback"] = fb.build(cmp, issue, target_sounds, seed)
    if issue == "mismatch":
        result["passed"] = None
    return result


NONWORD_EXERCISES = {"forward", "hiss", "hold"}
VOWEL_SOUND_TARGETS = {"ㅣ", "ㅔ", "ㅐ", "ㅏ", "ㅓ", "ㅗ", "ㅜ", "ㅡ"}
REF_SYL_SEC = 1 / 4.5  # 보통 빠르기 초당 4~5글자 → 글자 하나 약 0.22초


def _auto_exercise(kind: str, intonation: str | None) -> str | None:
    return "sentence" if kind in ("SENTENCE", "PARAGRAPH") else None


def evaluate_exercise(kind, target_pron, m, sylls, region, x, baseline, intonation) -> dict | None:
    """연습 종류별 판정. 모든 값은 이 녹음에서 잰 값이고, 기준 목소리가 없으면 비교하지 않는다."""
    if not kind:
        return None
    texts = syllable_texts(target_pron)
    aligned = len(sylls) == len(texts) and len(texts) > 0
    per = [{"text": texts[i] if aligned else None, **s} for i, s in enumerate(sylls)]
    out: dict = {"kind": kind, "syllables": per, "aligned": aligned}
    if kind in ("endclear", "sentence") and sylls:
        mean = float(np.mean([s["db"] for s in sylls]))
        weak = [i for i, s in enumerate(sylls) if s["db"] < mean - 8]
        tail = sylls[-max(1, len(sylls) // 4):]
        out["meanDb"] = round(mean, 1)
        out["weak"] = weak
        out["tailDrop"] = round(mean - float(np.mean([s["db"] for s in tail])), 1)
        # 끝 글자가 너무 작아 글자로 잡히지 않는 경우: 끝 20% 구간 음량을 직접 본다
        ed = au.end_drop(x, *region) if region[0] is not None else {"endDrop": None}
        out["regionDropDb"] = ed.get("dropDb")
        out["missingTail"] = len(sylls) < len(texts)
        out["ok"] = not weak and out["tailDrop"] < 8 and not ed.get("endDrop")
    if kind in ("intonation", "sentence") and intonation:
        slope = m.get("finalSlopeSt")
        out["want"] = intonation
        out["finalSlopeSt"] = slope
        out["contourSt"] = m.get("pitchContourSt")
        if slope is None:
            out["intonationOk"] = None
        else:
            out["intonationOk"] = slope >= 2.0 if intonation == "up" else slope <= 0.5
    if kind in ("timing", "sentence") and sylls:
        durs = [s["dur"] for s in sylls]
        total = region[1] - region[0] if region[0] is not None else sum(durs)
        out["totalSec"] = round(total, 2)
        out["refTotalSec"] = round(REF_SYL_SEC * len(texts), 2)
        out["rate"] = round(len(texts) / total, 2) if total else None
        out["long"] = [i for i, d in enumerate(durs) if d > REF_SYL_SEC * 1.8]
        out["refSylSec"] = round(REF_SYL_SEC, 2)
    if kind == "forward":
        start, end = region
        res = au.resonance(x, start, end)
        out["resonanceDb"] = res
        inten = m.get("intensityDb")
        b = baseline or {}
        if b.get("intensityDb") is not None and inten is not None:
            d = inten - b["intensityDb"]
            out["loudDeltaDb"] = round(d, 1)
            out["distanceRatio"] = round(float(10 ** (d / 20)), 2)  # 6dB 크면 약 2배 멀리
        if b.get("resonanceDb") is not None and res is not None:
            out["resonanceDelta"] = round(res - b["resonanceDb"], 1)
            out["position"] = round(float(np.clip(0.5 + (res - b["resonanceDb"]) / 20, 0, 1)), 2)
            out["ok"] = out["position"] >= 0.6
        else:
            out["position"] = None
            out["reason"] = "no_baseline"
        out["holdSec"] = m.get("durationSec")
    if kind == "hiss":
        out["hiss"] = m.get("hiss")
    return out


def nearest_in(f1: float, f2: float, targets: dict) -> str:
    return min(targets, key=lambda k: ((f1 - targets[k][0]) / 150) ** 2 + ((f2 - targets[k][1]) / 400) ** 2)


# ㅅ·ㅆ 바람 소리: 한 번에 적어도 이만큼은 새어 나와야 '바람이 있었다'고 본다
HISS_MIN_SEC = 0.04
# 바람 중심이 이보다 낮으면 혀가 넓게 닿아 '쉬'처럼 났을 수 있다 (ㅣ·ㅑ 등 앞에서는 원래 낮아져서 보지 않음)
HISS_LOW_KHZ = 4.0
PALATAL_VOWELS = set("ㅣㅑㅕㅛㅠㅒㅖㅟ")


def acoustic_checks(ops: list[dict], hiss: dict | None, target_pron: str) -> list[dict]:
    """받아쓰기가 ㅅ·ㅆ을 맞게 들었다고 해도, 녹음에 바람 소리가 거의 없거나 너무 낮으면 '같음'을 '확실하지 않음'으로 바꾼다.
    소리를 틀렸다고 단정하지 않는다: 녹음 자체에서 잰 값이 받아쓰기와 맞지 않을 때 판정을 보류할 뿐이다."""
    if not hiss:
        return []
    targets = [o for o in ops if o["target"] and o["target"]["symbol"] in HISS_SOUNDS and o["target"]["pos"] == "onset" and o["type"] in ("same", "allowed")]
    if not targets:
        return []
    n_all = sum(1 for p in phonemes(target_pron) if p.symbol in HISS_SOUNDS and p.pos == "onset")
    sec = hiss.get("hissSec") or 0.0
    khz = hiss.get("centroidKHz")
    vowels = {p.syl: p.symbol for p in phonemes(target_pron) if p.pos == "vowel"}
    out = []
    if sec < HISS_MIN_SEC * max(1, n_all) * 0.5:
        reason = "no_hiss"
    elif khz is not None and khz < HISS_LOW_KHZ and not any(vowels.get(o["target"]["syl"]) in PALATAL_VOWELS for o in targets):
        reason = "low_hiss"
    else:
        return []
    for o in targets:
        o["type"] = "unsure"
        o["reason"] = reason
        out.append({"symbol": o["target"]["symbol"], "syl": o["target"]["syl"], "reason": reason, "hissSec": sec, "centroidKHz": khz})
    return out
