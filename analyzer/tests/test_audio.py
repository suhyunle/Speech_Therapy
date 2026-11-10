import numpy as np
from malang_analyzer import audio as au
SR = 16000

def tone(f, sec, amp=0.3):
    t = np.arange(int(sec*SR))/SR
    return (amp*np.sin(2*np.pi*f*t)).astype(np.float32)

def pad(x, sec=0.5):
    z = (np.random.default_rng(0).normal(0, 0.0005, int(sec*SR))).astype(np.float32)
    return np.concatenate([z, x, z])

def test_quiet_detected():
    assert au.quality(pad(tone(200, 1.0, 0.002)))["issue"] == "too_quiet"

def test_short_detected():
    assert au.quality(pad(tone(200, 0.15)))["issue"] == "too_short"

def test_clip_detected():
    assert au.quality(pad(np.clip(tone(200, 1.0, 2.0), -1, 1)))["issue"] == "clipped"

def test_ok_and_pitch():
    x = pad(tone(220, 1.2))
    q = au.quality(x)
    assert q["ok"]
    p = au.pitch_stats(x)
    assert abs(p["medianHz"] - 220) < 5

def test_hiss_meter_high_noise():
    rng = np.random.default_rng(1)
    noise = rng.normal(0, 0.2, SR).astype(np.float32)
    # 6kHz 근처를 남기는 간단한 고역 강조
    spec = np.fft.rfft(noise); f = np.fft.rfftfreq(len(noise), 1/SR); spec[f < 4500] *= 0.02
    hiss = np.fft.irfft(spec, n=len(noise)).astype(np.float32)
    h = au.hiss_meter(pad(hiss))
    assert h["centroidKHz"] is not None and h["centroidKHz"] > 5.0 and h["hissSec"] > 0.5
