import io, os, shutil
import numpy as np, pytest, soundfile as sf
from malang_analyzer import audio as au, script as sc
from malang_analyzer.pipeline import analyze, evaluate_exercise
SR = 16000
MODEL = os.environ.get("ASR_MODEL_DIR", "")
HAS_MODEL = os.path.exists(os.path.join(MODEL, "tokens.txt"))

def tone(f, sec, amp=0.3):
    t = np.arange(int(sec * SR)) / SR
    return (amp * np.sin(2 * np.pi * f * t)).astype(np.float32)

def gap(sec):
    return np.zeros(int(sec * SR), dtype=np.float32) + np.random.default_rng(0).normal(0, 3e-4, int(sec * SR)).astype(np.float32)

def test_shape_marks_voice_and_wind():
    rng = np.random.default_rng(2)
    noise = rng.normal(0, 0.2, SR).astype(np.float32)
    spec = np.fft.rfft(noise); f = np.fft.rfftfreq(len(noise), 1 / SR); spec[f < 4500] *= 0.02
    wind = np.fft.irfft(spec, n=len(noise)).astype(np.float32)
    x = np.concatenate([gap(0.3), wind, tone(200, 1.0), gap(0.3)])
    kinds = [b["kind"] for b in au.shape(x)]
    assert "wind" in kinds and "voice" in kinds
    assert kinds.index("wind") < max(i for i, k in enumerate(kinds) if k == "voice")

def test_syllable_nuclei_counts_bursts():
    x = np.concatenate([gap(0.3)] + [np.concatenate([tone(180, 0.18), gap(0.12)]) for _ in range(4)] + [gap(0.3)])
    q = au.quality(x)
    n = au.syllable_nuclei(x, *q["region"])
    assert len(n) == 4
    assert all(0.15 < s["dur"] < 0.45 for s in n)

def test_end_drop_detected():
    loud = [tone(180, 0.2, 0.3) for _ in range(4)] + [tone(180, 0.2, 0.01)]
    x = np.concatenate([gap(0.3)] + [np.concatenate([s, gap(0.1)]) for s in loud] + [gap(0.3)])
    q = au.quality(x)
    sy = au.syllable_nuclei(x, *q["region"])
    ex = evaluate_exercise("endclear", "사과를세개", {"finalSlopeSt": None}, sy, q["region"], x, None, None)
    assert ex["ok"] is False

def test_forward_needs_baseline_and_compares():
    x = np.concatenate([gap(0.3), tone(200, 2.0), gap(0.3)])
    q = au.quality(x)
    m = {"intensityDb": 70.0, "durationSec": 2.0}
    no = evaluate_exercise("forward", "음", m, [], q["region"], x, None, None)
    assert no["position"] is None and no["reason"] == "no_baseline"
    yes = evaluate_exercise("forward", "음", m, [], q["region"], x, {"intensityDb": 64.0, "resonanceDb": -30.0}, None)
    assert yes["distanceRatio"] == pytest.approx(2.0, rel=0.01) and yes["position"] is not None

def test_vowel_helpers():
    assert au.nearest_vowel(900, 1550, "f") == "ㅏ"
    assert au.nearest_vowel(420, 850, "f") == "ㅗ"
    assert au.triangle_area({"ㅣ": (300, 2800), "ㅏ": (900, 1500), "ㅜ": (350, 900)}) > 0

def test_extract_pptx_and_text():
    from pptx import Presentation
    prs = Presentation(); s = prs.slides.add_slide(prs.slide_layouts[1])
    s.shapes.title.text = "사업 계획"; s.placeholders[1].text = "안녕하세요. 설명드리겠습니다."
    buf = io.BytesIO(); prs.save(buf)
    slides = sc.extract(buf.getvalue(), "pptx")
    assert slides[0]["n"] == 1 and "안녕하세요" in slides[0]["text"]
    t = sc.extract("첫 문단입니다.\n\n둘째 문단입니다.".encode(), "text")
    assert len(t) == 2

@pytest.mark.skipif(not shutil.which("tesseract"), reason="tesseract 없음")
def test_extract_image_ocr():
    from PIL import Image, ImageDraw, ImageFont
    fonts = [p for p in ["/usr/share/fonts/truetype/nanum/NanumGothic.ttf", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc"] if os.path.exists(p)]
    if not fonts:
        pytest.skip("한글 글꼴 없음")
    img = Image.new("RGB", (900, 160), "white"); ImageDraw.Draw(img).text((20, 40), "안녕하세요 발표입니다", fill="black", font=ImageFont.truetype(fonts[0], 60))
    buf = io.BytesIO(); img.save(buf, "PNG")
    text = sc.extract(buf.getvalue(), "image")[0]["text"].replace(" ", "")
    assert "안녕하세요" in text

def test_decode_any_mp3_roundtrip(tmp_path):
    x = np.concatenate([gap(0.2), tone(220, 1.0), gap(0.2)])
    wav = tmp_path / "a.wav"; sf.write(wav, x, SR, subtype="PCM_16")
    import subprocess
    mp3 = tmp_path / "a.mp3"; subprocess.run([sc._ffmpeg(), "-v", "error", "-i", str(wav), str(mp3)], check=True)
    y = sc.decode_any(mp3.read_bytes())
    assert abs(len(y) / SR - 1.4) < 0.15

@pytest.mark.skipif(not HAS_MODEL, reason="ASR model not present")
def test_script_run_finds_changed_and_skipped():
    d = os.path.join(MODEL, "test_wavs")
    x = np.concatenate([sf.read(os.path.join(d, f"{i}.wav"), dtype="float32")[0] for i in (1, 3)])
    res = sc.analyze_run(x, [{"n": 1, "text": "지하철에서 사리를 벌리고 앉지 마라."}, {"n": 2, "text": "오늘 날씨가 좋네요. 주민등록증을 보여 주시겠어요?"}], True)
    st = {w["text"]: w["status"] for w in res["words"]}
    assert st["사리를"] == "changed" and st["날씨가"] == "skipped" and st["주민등록증을"] == "ok"
    assert {"pair": "ㅅ→ㄷ", "count": 1} in res["substitutions"]
    assert res["totalSentences"] == 3 and res["clearSentences"] == 1

@pytest.mark.skipif(not HAS_MODEL, reason="ASR model not present")
def test_question_rises():
    x, _ = sf.read(os.path.join(MODEL, "test_wavs/3.wav"), dtype="float32")
    r = analyze(x, "주민등록증을 보여 주시겠어요?", None, "SENTENCE", [], None, 0, "intonation", "up")
    assert r["exercise"]["intonationOk"] is True

def test_sound_only_exercise_skips_text_compare():
    x = np.concatenate([gap(0.3), tone(150, 2.0), gap(0.3)])
    r = analyze(x, "음", "음", "SYLLABLE", [], None, 0, "forward", None)
    assert r["phonemes"] is None and "sound_only_exercise" in r["limits"] and r["exercise"]["kind"] == "forward"


def test_acoustic_check_flags_missing_hiss():
    from malang_analyzer.pipeline import acoustic_checks
    ops = [{"target": {"symbol": "ㅅ", "pos": "onset", "syl": 0}, "got": {"symbol": "ㅅ", "pos": "onset", "syl": 0}, "type": "same"},
           {"target": {"symbol": "ㅏ", "pos": "vowel", "syl": 0}, "got": {"symbol": "ㅏ", "pos": "vowel", "syl": 0}, "type": "same"}]
    c = acoustic_checks(ops, {"centroidKHz": None, "hissSec": 0.0}, "사과")
    assert c and c[0]["reason"] == "no_hiss" and ops[0]["type"] == "unsure" and ops[1]["type"] == "same"

def test_acoustic_check_low_hiss_and_ok():
    from malang_analyzer.pipeline import acoustic_checks
    mk = lambda: [{"target": {"symbol": "ㅅ", "pos": "onset", "syl": 0}, "got": {"symbol": "ㅅ", "pos": "onset", "syl": 0}, "type": "same"}]
    assert acoustic_checks(mk(), {"centroidKHz": 3.6, "hissSec": 0.15}, "사과")[0]["reason"] == "low_hiss"
    assert acoustic_checks(mk(), {"centroidKHz": 3.6, "hissSec": 0.15}, "시계") == []  # ㅣ 앞은 원래 낮아짐
    assert acoustic_checks(mk(), {"centroidKHz": 6.8, "hissSec": 0.15}, "사과") == []

def test_hiss_meter_on_real_noise():
    rng = np.random.default_rng(1)
    noise = rng.normal(0, 0.1, int(0.3 * SR)).astype(np.float32)
    # 6kHz 위만 남긴 바람 소리
    spec = np.fft.rfft(noise); f = np.fft.rfftfreq(len(noise), 1 / SR); spec[f < 5500] = 0
    hiss = np.fft.irfft(spec, len(noise)).astype(np.float32) * 3
    x = np.concatenate([gap(0.3), hiss, tone(200, 0.3), gap(0.3)])
    h = au.hiss_meter(x)
    assert h["hissSec"] >= 0.2 and h["centroidKHz"] > 6
