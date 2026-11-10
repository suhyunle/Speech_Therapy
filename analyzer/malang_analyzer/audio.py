"""녹음 검사(녹음 문제 5가지)와 신호처리 측정.

모든 값은 실제 녹음에서 계산한다. 계산할 수 없으면 None과 이유를 돌려준다.
"""
from __future__ import annotations

import io

import numpy as np
import parselmouth
import soundfile as sf

SR = 16000
FRAME = 400  # 25ms
HOP = 160  # 10ms


def load_wav(data: bytes) -> np.ndarray:
    audio, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=True)
    audio = audio.mean(axis=1)
    if sr != SR and len(audio) > 1:
        n = int(round(len(audio) * SR / sr))
        audio = np.interp(np.linspace(0, len(audio) - 1, n), np.arange(len(audio)), audio).astype(np.float32)
    return audio


def _frames_db(x: np.ndarray) -> np.ndarray:
    if len(x) < FRAME:
        x = np.pad(x, (0, FRAME - len(x)))
    n = 1 + (len(x) - FRAME) // HOP
    idx = np.arange(FRAME)[None, :] + HOP * np.arange(n)[:, None]
    rms = np.sqrt(np.mean(x[idx] ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms + 1e-12)


def speech_region(x: np.ndarray) -> dict:
    """에너지 기반 말소리 구간. 잡음 바닥(10번째 백분위) + 10dB 이상, -45dBFS 이상인 프레임."""
    db = _frames_db(x)
    floor = float(np.percentile(db, 10))
    thr = max(floor + 10.0, -45.0)
    voiced = db > thr
    if not voiced.any():
        return {"start": None, "end": None, "frames": voiced, "floor": floor, "db": db, "duration": 0.0}
    idx = np.where(voiced)[0]
    start, end = int(idx[0]), int(idx[-1])
    return {
        "start": start * HOP / SR,
        "end": (end * HOP + FRAME) / SR,
        "frames": voiced,
        "floor": floor,
        "db": db,
        "duration": float(voiced.sum() * HOP / SR),
    }


def quality(x: np.ndarray) -> dict:
    """녹음 문제 감지. issue: clipped | too_quiet | noisy | too_short | None"""
    region = speech_region(x)
    db = region["db"]
    peak_db = float(db.max()) if len(db) else -120.0
    clip_ratio = float(np.mean(np.abs(x) >= 0.99)) if len(x) else 0.0
    speech_db = float(np.mean(db[region["frames"]])) if region["frames"].any() else -120.0
    info = {
        "peakDb": round(peak_db, 1),
        "speechDb": round(speech_db, 1),
        "noiseDb": round(region["floor"], 1),
        "snrDb": round(speech_db - region["floor"], 1) if region["frames"].any() else None,
        "speechSec": round(region["duration"], 2),
        "totalSec": round(len(x) / SR, 2),
        "clipRatio": round(clip_ratio, 4),
    }
    issue = None
    if clip_ratio > 0.001:
        issue = "clipped"
    elif peak_db < -40:
        issue = "too_quiet"
    elif region["floor"] > -38 and (info["snrDb"] or 0) < 10:
        issue = "noisy"
    elif region["duration"] < 0.3:
        issue = "too_short"
    return {"ok": issue is None, "issue": issue, **info, "region": (region["start"], region["end"])}


def _sound(x: np.ndarray) -> parselmouth.Sound:
    return parselmouth.Sound(x.astype(np.float64), sampling_frequency=SR)


def pitch_stats(x: np.ndarray) -> dict:
    snd = _sound(x)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=70, pitch_ceiling=500)
    f0 = pitch.selected_array["frequency"]
    times = pitch.xs()
    voiced = f0 > 0
    if voiced.sum() < 5:
        return {"medianHz": None, "contourSt": [], "finalSlopeSt": None}
    med = float(np.median(f0[voiced]))
    st = 12 * np.log2(f0[voiced] / med)
    t = times[voiced]
    # 마지막 0.3초 기울기 → 묻는 말(올림) / 말하는 말(내림)
    tail = t >= (t[-1] - 0.3)
    slope = None
    if tail.sum() >= 4:
        slope = float(np.polyfit(t[tail], st[tail], 1)[0] * 0.3)
    step = max(1, len(st) // 60)
    return {
        "medianHz": round(med, 1),
        "contourSt": [round(float(v), 2) for v in st[::step]],
        "finalSlopeSt": None if slope is None else round(slope, 2),
    }


def intensity_db(x: np.ndarray, start: float | None, end: float | None) -> float | None:
    if start is None:
        return None
    snd = _sound(x)
    inten = snd.to_intensity(minimum_pitch=75)
    vals = inten.values[0]
    t = inten.xs()
    sel = (t >= start) & (t <= end)
    if sel.sum() == 0:
        return None
    return round(float(np.mean(vals[sel])), 1)


def end_drop(x: np.ndarray, start: float | None, end: float | None) -> dict:
    """문장 끝 20% 구간 음량이 전체 평균보다 8dB 넘게 낮으면 '끝소리 작아짐'."""
    if start is None or end - start < 0.8:
        return {"dropDb": None, "endDrop": None}
    snd = _sound(x)
    inten = snd.to_intensity(minimum_pitch=75)
    v, t = inten.values[0], inten.xs()
    sel = (t >= start) & (t <= end)
    tail = (t >= end - (end - start) * 0.2) & (t <= end)
    if sel.sum() == 0 or tail.sum() == 0:
        return {"dropDb": None, "endDrop": None}
    drop = float(np.mean(v[sel]) - np.mean(v[tail]))
    return {"dropDb": round(drop, 1), "endDrop": drop > 8.0}


def formants(x: np.ndarray, start: float | None, end: float | None) -> dict:
    """모음 지도용 F1·F2. 말소리 가운데 50% 구간 중앙값."""
    if start is None or end - start < 0.12:
        return {"f1": None, "f2": None}
    snd = _sound(x)
    fm = snd.to_formant_burg(time_step=0.01, max_number_of_formants=5, maximum_formant=5500)
    a = start + (end - start) * 0.25
    b = start + (end - start) * 0.75
    f1s, f2s = [], []
    for tt in np.arange(a, b, 0.01):
        f1, f2 = fm.get_value_at_time(1, tt), fm.get_value_at_time(2, tt)
        if f1 == f1 and f2 == f2:  # NaN 제외
            f1s.append(f1)
            f2s.append(f2)
    if len(f1s) < 3:
        return {"f1": None, "f2": None}
    return {"f1": round(float(np.median(f1s))), "f2": round(float(np.median(f2s)))}


def hiss_meter(x: np.ndarray) -> dict:
    """ㅅ 쉬익 미터: 4kHz 위 에너지 비율이 높은 프레임(마찰 구간)의 스펙트럼 중심과 길이."""
    if len(x) < FRAME:
        return {"centroidKHz": None, "hissSec": 0.0}
    n = 1 + (len(x) - 512) // HOP
    if n <= 0:
        return {"centroidKHz": None, "hissSec": 0.0}
    win = np.hanning(512)
    idx = np.arange(512)[None, :] + HOP * np.arange(n)[:, None]
    spec = np.abs(np.fft.rfft(x[idx] * win, axis=1)) ** 2
    freqs = np.fft.rfftfreq(512, 1 / SR)
    total = spec.sum(axis=1) + 1e-12
    high = spec[:, freqs >= 4000].sum(axis=1)
    ratio = high / total
    db = 10 * np.log10(total / 512 + 1e-12)
    loud = db > (np.percentile(db, 10) + 10)
    fric = (ratio > 0.5) & loud
    if fric.sum() < 3:
        return {"centroidKHz": None, "hissSec": round(float(fric.sum() * HOP / SR), 2)}
    centroid = (spec[fric] * freqs[None, :]).sum(axis=1) / spec[fric].sum(axis=1)
    return {
        "centroidKHz": round(float(np.median(centroid)) / 1000, 1),
        "hissSec": round(float(fric.sum() * HOP / SR), 2),
    }


def measure(x: np.ndarray, q: dict, kind: str, syllable_count: int, wants_hiss: bool, wants_formant: bool) -> dict:
    start, end = q["region"]
    p = pitch_stats(x)
    out = {
        "intensityDb": intensity_db(x, start, end),
        "pitchHz": p["medianHz"],
        "pitchContourSt": p["contourSt"],
        "finalSlopeSt": p["finalSlopeSt"],
        "durationSec": q["speechSec"],
        "rateSylPerSec": None,
        "hiss": hiss_meter(x) if wants_hiss else None,
        "formants": formants(x, start, end) if wants_formant else None,
        **(end_drop(x, start, end) if kind in ("SENTENCE", "PARAGRAPH") else {"dropDb": None, "endDrop": None}),
    }
    if kind in ("SENTENCE", "PARAGRAPH") and start is not None and end - start > 0:
        out["rateSylPerSec"] = round(syllable_count / (end - start), 2)
    return out


def compare_voice(m: dict, baseline: dict | None) -> dict:
    """기준 목소리와 비교해 크기·높이·빠르기 상태를 정한다. 기준이 없으면 None."""
    if not baseline:
        return {"loudness": None, "pitch": None, "rate": None, "reason": "no_baseline"}
    res: dict = {"reason": None}
    bi, mi = baseline.get("intensityDb"), m.get("intensityDb")
    res["loudness"] = None if bi is None or mi is None else ("low" if mi < bi - 6 else "high" if mi > bi + 8 else "ok")
    bp, mp = baseline.get("pitchHz"), m.get("pitchHz")
    if bp and mp:
        st = 12 * np.log2(mp / bp)
        res["pitch"] = "high" if st > 3 else "low" if st < -3 else "ok"
        res["pitchSt"] = round(float(st), 1)
    else:
        res["pitch"] = None
    r = m.get("rateSylPerSec")
    res["rate"] = None if r is None else ("slow" if r < 2.5 else "fast" if r > 6.5 else "ok")
    return res


# ── 화면별 추가 측정 ─────────────────────────────────────────────

def shape(x: np.ndarray, bins: int = 60) -> list[dict]:
    """소리 모양: 시간 순서대로 '바람'(주황) · '목소리'(보라) · 쉼. 디자인 '바람은 주황, 목소리는 보라'."""
    if len(x) < 512:
        return []
    snd = _sound(x)
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=70, pitch_ceiling=500)
    f0 = pitch.selected_array["frequency"]
    pt = pitch.xs()
    n = 1 + (len(x) - 512) // HOP
    win = np.hanning(512)
    idx = np.arange(512)[None, :] + HOP * np.arange(n)[:, None]
    spec = np.abs(np.fft.rfft(x[idx] * win, axis=1)) ** 2
    freqs = np.fft.rfftfreq(512, 1 / SR)
    total = spec.sum(axis=1) + 1e-12
    ratio = spec[:, freqs >= 4000].sum(axis=1) / total
    db = 10 * np.log10(total / 512 + 1e-12)
    floor = np.percentile(db, 10)
    t = (np.arange(n) * HOP + 256) / SR
    voiced = np.interp(t, pt, (f0 > 0).astype(float), left=0, right=0) > 0.5
    loud = db > floor + 10
    out = []
    edges = np.linspace(0, n, bins + 1).astype(int)
    peak = db.max() if len(db) else 0
    for a, b in zip(edges[:-1], edges[1:]):
        if b <= a:
            continue
        l, v, r = loud[a:b].mean(), voiced[a:b].mean(), ratio[a:b].mean()
        kind = "silence" if l < 0.5 else ("voice" if v >= 0.5 else ("wind" if r > 0.35 else "voice"))
        level = float(np.clip((db[a:b].mean() - floor) / max(peak - floor, 1e-6), 0, 1))
        out.append({"t": round(float(t[a]), 2), "kind": kind, "level": round(level, 2)})
    return out


def syllable_nuclei(x: np.ndarray, start: float | None, end: float | None) -> list[dict]:
    """글자(음절) 핵 찾기: 음량 봉우리 + 목소리 있음 (de Jong & Wempe 방식을 줄인 규칙).
    봉우리 사이 가운데를 경계로 글자마다 길이·크기를 잰다."""
    if start is None or end - start < 0.15:
        return []
    snd = _sound(x)
    inten = snd.to_intensity(minimum_pitch=75, time_step=0.01)
    v, t = inten.values[0], inten.xs()
    sel = (t >= start) & (t <= end)
    v, t = v[sel], t[sel]
    if len(v) < 5:
        return []
    k = np.ones(5) / 5
    vs = np.convolve(v, k, mode="same")
    thr = np.median(vs) - 2
    pitch = snd.to_pitch(time_step=0.01, pitch_floor=70, pitch_ceiling=500)
    f0 = pitch.selected_array["frequency"]
    voiced = np.interp(t, pitch.xs(), (f0 > 0).astype(float), left=0, right=0) > 0.5
    peaks = []
    for i in range(1, len(vs) - 1):
        if vs[i] >= vs[i - 1] and vs[i] > vs[i + 1] and vs[i] > thr and voiced[i]:
            if peaks:
                j = peaks[-1]
                dip = vs[j:i + 1].min()
                if min(vs[j], vs[i]) - dip < 2.0 or t[i] - t[j] < 0.08:
                    if vs[i] > vs[j]:
                        peaks[-1] = i
                    continue
            peaks.append(i)
    if not peaks:
        return []
    bounds = [start] + [float((t[a] + t[b]) / 2) for a, b in zip(peaks[:-1], peaks[1:])] + [end]
    return [
        {"t": round(float(t[p]), 2), "dur": round(bounds[i + 1] - bounds[i], 2), "db": round(float(v[p]), 1)}
        for i, p in enumerate(peaks)
    ]


def resonance(x: np.ndarray, start: float | None, end: float | None) -> float | None:
    """울림 위치 근사: 목소리 구간에서 1~4kHz 에너지 / 0~1kHz 에너지 (dB).
    값이 클수록 소리가 입 앞쪽에서 밝게 울린다(‘앞으로’). 기준 목소리와의 차이로만 본다."""
    if start is None or end - start < 0.2:
        return None
    seg = x[int(start * SR):int(end * SR)]
    if len(seg) < 1024:
        return None
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    lo = spec[(f >= 80) & (f < 1000)].sum() + 1e-12
    hi = spec[(f >= 1000) & (f < 4000)].sum() + 1e-12
    return round(float(10 * np.log10(hi / lo)), 1)


# 성인 평균 모음 위치(Hz, 대략) — 한국어 단모음 음향 연구 값을 반올림. 화면에는 '대략적인 목표'로만 쓴다.
VOWEL_TARGETS = {
    "f": {"ㅣ": (310, 2790), "ㅔ": (500, 2350), "ㅐ": (520, 2300), "ㅏ": (900, 1550), "ㅓ": (630, 1150), "ㅗ": (420, 850), "ㅜ": (360, 1000), "ㅡ": (370, 1600)},
    "m": {"ㅣ": (280, 2300), "ㅔ": (440, 1950), "ㅐ": (460, 1900), "ㅏ": (750, 1300), "ㅓ": (560, 950), "ㅗ": (380, 750), "ㅜ": (320, 850), "ㅡ": (330, 1400)},
}


def vowel_set(baseline: dict | None) -> str:
    p = (baseline or {}).get("pitchHz")
    return "m" if p and p < 165 else "f"


def nearest_vowel(f1: float, f2: float, which: str) -> str:
    t = VOWEL_TARGETS[which]
    return min(t, key=lambda k: ((f1 - t[k][0]) / 150) ** 2 + ((f2 - t[k][1]) / 400) ** 2)


def triangle_area(points: dict[str, tuple[float, float]]) -> float | None:
    """ㅣ·ㅏ·ㅜ 모음 삼각형 넓이 (Hz²)"""
    try:
        (a1, a2), (b1, b2), (c1, c2) = points["ㅣ"], points["ㅏ"], points["ㅜ"]
    except KeyError:
        return None
    return abs(a2 * (b1 - c1) + b2 * (c1 - a1) + c2 * (a1 - b1)) / 2
