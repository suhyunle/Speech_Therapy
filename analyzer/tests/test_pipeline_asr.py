import os, soundfile as sf, pytest
from malang_analyzer.pipeline import analyze
MODEL = os.environ.get("ASR_MODEL_DIR", "")

@pytest.mark.skipif(not os.path.exists(os.path.join(MODEL, "tokens.txt")), reason="ASR model not present")
def test_real_recognition_on_model_sample():
    x, sr = sf.read(os.path.join(MODEL, "test_wavs/3.wav"), dtype="float32")
    r = analyze(x, "주민등록증을 보여 주시겠어요?", None, "SENTENCE", ["ㅈ"], None)
    assert r["quality"]["ok"]
    assert r["heard"] and "주민등록증" in r["heard"].replace(" ", "")
    assert r["phonemes"]["matched"] >= r["phonemes"]["total"] - 2
    assert r["voice"]["reason"] == "no_baseline"
