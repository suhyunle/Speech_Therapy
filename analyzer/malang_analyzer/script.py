"""내 글로 연습: 원고(PPT·PDF·사진·글)에서 글을 뽑고, 긴 녹음을 원고와 맞춰본다.

- 글 뽑기: python-pptx · pypdf · tesseract(kor) · 붙여넣은 글
- 녹음: ffmpeg로 16kHz 모노로 바꾼 뒤, 쉼 구간에서 잘라(최대 15초) 하나씩 인식
- 맞춰보기: 원고 글자와 들린 글자를 편집거리로 정렬 → 단어마다 같음 / 달라짐 / 건너뜀, 원고에 없는 말
"""
from __future__ import annotations

import io
import os
import re
import shutil
import subprocess
import tempfile

import numpy as np

from . import align as al
from . import audio as au
from .pronounce import is_hangul, phonemes, standard_pronunciation
from .recognizer import get_recognizer

SR = au.SR


# ── 글 뽑기 ─────────────────────────────────────────────

def _clean(t: str) -> str:
    return re.sub(r"[ \t]+", " ", t).strip()


def extract(data: bytes, source: str) -> list[dict]:
    if source == "pptx":
        from pptx import Presentation

        prs = Presentation(io.BytesIO(data))
        slides = []
        for i, slide in enumerate(prs.slides, 1):
            parts = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    parts += [p.text for p in shape.text_frame.paragraphs if p.text.strip()]
                if getattr(shape, "has_table", False) and shape.has_table:
                    for row in shape.table.rows:
                        parts += [c.text for c in row.cells if c.text.strip()]
            slides.append({"n": i, "text": _clean(" ".join(parts))})
        return slides
    if source == "pdf":
        from pypdf import PdfReader

        r = PdfReader(io.BytesIO(data))
        return [{"n": i, "text": _clean((p.extract_text() or "").replace("\n", " "))} for i, p in enumerate(r.pages, 1)]
    if source == "image":
        import pytesseract
        from PIL import Image

        if not shutil.which("tesseract"):
            raise RuntimeError("이 서버에는 사진 글자 읽기(OCR)가 설치되어 있지 않아요")
        text = pytesseract.image_to_string(Image.open(io.BytesIO(data)), lang="kor+eng")
        return [{"n": 1, "text": _clean(text.replace("\n", " "))}]
    # 붙여넣은 글: 빈 줄로 나눈 덩어리를 한 장으로 본다
    text = data.decode("utf-8", errors="replace")
    blocks = [b for b in re.split(r"\n\s*\n", text) if b.strip()]
    return [{"n": i, "text": _clean(b.replace("\n", " "))} for i, b in enumerate(blocks or [text], 1)]


# ── 녹음 ─────────────────────────────────────────────

def _ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def decode_any(data: bytes) -> np.ndarray:
    """wav · mp3 · m4a · webm … → 16kHz 모노 float32"""
    if data[:4] == b"RIFF":
        try:
            return au.load_wav(data)
        except Exception:
            pass
    with tempfile.NamedTemporaryFile(suffix=".bin") as f:
        f.write(data)
        f.flush()
        out = subprocess.run([_ffmpeg(), "-v", "error", "-i", f.name, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True)
    return np.frombuffer(out.stdout, dtype=np.float32).copy()


def chunks(x: np.ndarray, max_sec: float = 15.0) -> list[tuple[float, float]]:
    """쉼(0.3초 이상 조용한 곳)에서 잘라 인식하기 좋은 길이로 나눈다."""
    db = au._frames_db(x)
    floor = np.percentile(db, 10)
    quiet = db < max(floor + 8, -50)
    hop = au.HOP / SR
    cuts, run = [], 0
    for i, q in enumerate(quiet):
        run = run + 1 if q else 0
        if run == int(0.3 / hop):
            cuts.append((i - run / 2) * hop)
    total = len(x) / SR
    bounds, start = [], 0.0
    for c in cuts + [total]:
        if c - start >= max_sec or c == total:
            # 너무 길면 중간 쉼에서 자른다
            inner = [k for k in cuts if start + 3 < k < c]
            while c - start > max_sec and inner:
                k = max((k for k in inner if k - start <= max_sec), default=inner[0])
                bounds.append((start, k))
                start = k
                inner = [j for j in inner if j > k]
            if c - start > 0.2:
                bounds.append((start, c))
            start = c
    return bounds


def recognize_long(x: np.ndarray) -> list[tuple[str, float]]:
    """들린 글자와 그 시각. 띄어쓰기는 ' ' 로 둔다."""
    rec = get_recognizer()
    if rec is None:
        raise RuntimeError("음성 인식 모델이 없어요")
    chars: list[tuple[str, float]] = []
    for a, b in chunks(x):
        r = rec.recognize(x[int(a * SR):int(b * SR)])
        for tok, t in zip(r.tokens, r.timestamps):
            piece = tok.replace("▁", " ")
            for ch in piece:
                chars.append((ch, a + t))
        chars.append((" ", b))
    return chars


# ── 맞춰보기 ─────────────────────────────────────────────

def _align_chars(a: list[str], b: list[str]) -> list[tuple[int | None, int | None]]:
    """원고 글자 a 와 들린 글자 b 정렬 (편집거리, 띠 제한 없이 단순 DP)"""
    n, m = len(a), len(b)
    prev = list(range(m + 1))
    back = np.zeros((n + 1, m + 1), dtype=np.uint8)  # 0 대각 1 위(빠짐) 2 왼(더해짐)
    back[0, 1:] = 2
    for i in range(1, n + 1):
        cur = [i] + [0] * m
        back[i, 0] = 1
        ai = a[i - 1]
        for j in range(1, m + 1):
            d = prev[j - 1] + (0 if ai == b[j - 1] else 1)
            u = prev[j] + 1
            left = cur[j - 1] + 1
            if d <= u and d <= left:
                cur[j], back[i, j] = d, 0
            elif u <= left:
                cur[j], back[i, j] = u, 1
            else:
                cur[j], back[i, j] = left, 2
        prev = cur
    pairs, i, j = [], n, m
    while i > 0 or j > 0:
        k = back[i, j]
        if i > 0 and j > 0 and k == 0:
            pairs.append((i - 1, j - 1))
            i, j = i - 1, j - 1
        elif i > 0 and (k == 1 or j == 0):
            pairs.append((i - 1, None))
            i -= 1
        else:
            pairs.append((None, j - 1))
            j -= 1
    pairs.reverse()
    return pairs


SENT_END = re.compile(r"(?<=[.!?。])\s+|(?<=다\.)|(?<=요\.)")


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def analyze_run(x: np.ndarray, slides: list[dict], free_speech: bool) -> dict:
    heard = recognize_long(x)
    # 원고 → 슬라이드 · 문장 · 단어 · 글자
    words = []  # {slide, sent, text, chars: [idx]}
    script_chars: list[str] = []
    sentences = []
    for sl in slides:
        for s in split_sentences(sl["text"]):
            si = len(sentences)
            sentences.append({"slide": sl["n"], "text": s, "words": []})
            for w in s.split():
                idxs = []
                for ch in w:
                    if is_hangul(ch):
                        idxs.append(len(script_chars))
                        script_chars.append(ch)
                if idxs:
                    sentences[si]["words"].append(len(words))
                    words.append({"slide": sl["n"], "sent": si, "text": w, "chars": idxs})
    h_chars = [(c, t) for c, t in heard if is_hangul(c)]
    pairs = _align_chars(script_chars, [c for c, _ in h_chars])

    # 원고 글자마다 들린 글자 · 시각
    got: dict[int, tuple[str, float]] = {}
    extras: list[tuple[int, str, float]] = []  # (앞 원고 글자 위치, 글자, 시각)
    last_i = -1
    for i, j in pairs:
        if i is not None:
            last_i = i
            if j is not None:
                got[i] = h_chars[j]
        elif j is not None:
            extras.append((last_i, h_chars[j][0], h_chars[j][1]))

    total = len(x) / SR
    inten = au._sound(x).to_intensity(minimum_pitch=75, time_step=0.01)
    iv, it = inten.values[0], inten.xs()

    def level(t0: float, t1: float) -> float | None:
        sel = (it >= t0) & (it <= t1)
        return float(np.mean(iv[sel])) if sel.any() else None

    sub_counts: dict[str, int] = {}
    sound_seen: dict[str, int] = {}
    sound_bad: dict[str, int] = {}
    out_words = []
    for w in words:
        heard_txt = "".join(got[i][0] if i in got else "" for i in w["chars"])
        same = all(i in got and got[i][0] == script_chars[i] for i in w["chars"])
        missing = sum(1 for i in w["chars"] if i not in got)
        status = "ok" if same else ("skipped" if missing == len(w["chars"]) else "changed")
        times = [got[i][1] for i in w["chars"] if i in got]
        target_core = "".join(script_chars[i] for i in w["chars"])
        if status == "changed" and heard_txt:
            cmp = al.compare(standard_pronunciation(target_core), standard_pronunciation(heard_txt))
            for o in cmp["ops"]:
                if o["type"] == "sub" and o["target"] and o["got"]:
                    k = f'{o["target"]["symbol"]}→{o["got"]["symbol"]}'
                    sub_counts[k] = sub_counts.get(k, 0) + 1
        for p in phonemes(standard_pronunciation(target_core)):
            if p.pos == "coda":
                continue
            sound_seen[p.symbol] = sound_seen.get(p.symbol, 0) + 1
            if status != "ok":
                sound_bad[p.symbol] = sound_bad.get(p.symbol, 0) + 1
        out_words.append({"text": w["text"], "core": target_core, "status": status, "heard": heard_txt if status == "changed" else None, "t": round(times[0], 2) if times else None, "sent": w["sent"], "slide": w["slide"]})

    # 원고에 없는 말 (2글자 이상 이어진 것만)
    extra_runs: list[dict] = []
    for pos, ch, t in extras:
        if extra_runs and extra_runs[-1]["after"] == pos and t - extra_runs[-1]["t1"] < 1.0:
            extra_runs[-1]["text"] += ch
            extra_runs[-1]["t1"] = t
        else:
            extra_runs.append({"after": pos, "text": ch, "t0": t, "t1": t})
    extra_runs = [e for e in extra_runs if len(e["text"]) >= 2]
    char_to_word = {i: wi for wi, w in enumerate(words) for i in w["chars"]}

    out_sents = []
    end_drops = 0
    for si, s in enumerate(sentences):
        ws = [out_words[k] for k in s["words"]]
        times = [w["t"] for w in ws if w["t"] is not None]
        drop = None
        if len(times) >= 2:
            t0, t1 = times[0], times[-1]
            mean, last = level(t0, t1 + 0.4), level(t1, t1 + 0.4)
            if mean is not None and last is not None:
                drop = round(mean - last, 1)
        weak_end = drop is not None and drop > 8
        end_drops += int(weak_end)
        clear = all(w["status"] == "ok" for w in ws) and not weak_end
        ex = [e["text"] for e in extra_runs if char_to_word.get(e["after"], -1) in s["words"]]
        out_sents.append({"slide": s["slide"], "text": s["text"], "words": [k for k in s["words"]], "clear": clear, "endDrop": weak_end, "dropDb": drop, "extras": ex if not free_speech or ex else []})

    # 빠르기 흐름: 20초마다 초당 글자 수
    ts = sorted(t for _, t in got.values())
    windows = []
    for a in np.arange(0, total, 20.0):
        n = sum(1 for t in ts if a <= t < a + 20)
        windows.append({"t": round(float(a), 1), "rate": round(n / min(20.0, total - a), 2) if total - a > 1 else None})
    base_rate = np.mean([w["rate"] for w in windows[:3] if w["rate"]]) if windows else None
    faster_from = None
    if base_rate:
        for w in windows[3:]:
            if w["rate"] and w["rate"] > base_rate * 1.25:
                faster_from = w["t"]
                break

    good = sorted(s for s, n in sound_seen.items() if n >= 5 and sound_bad.get(s, 0) == 0)
    changed = [w for w in out_words if w["status"] == "changed"]
    return {
        "durationSec": round(total, 1),
        "sentences": out_sents,
        "words": out_words,
        "extras": extra_runs,
        "clearSentences": sum(1 for s in out_sents if s["clear"]),
        "totalSentences": len(out_sents),
        "substitutions": sorted(({"pair": k, "count": v} for k, v in sub_counts.items()), key=lambda d: -d["count"]),
        "endDrops": end_drops,
        "rateWindows": windows,
        "fasterFromSec": faster_from,
        "goodSounds": good,
        "practiceWords": list(dict.fromkeys(w["core"] for w in changed))[:8],
        "heardText": "".join(c for c, _ in heard).strip(),
        "freeSpeech": free_speech,
        "model": get_recognizer().name if get_recognizer() else None,
        "limits": ["word_level_asr"],
    }
