import pytest
from malang_analyzer.pronounce import standard_pronunciation as sp, phonemes

@pytest.mark.parametrize("text,expected", [
    ("사과", "사과"), ("같이", "가치"), ("좋아요", "조아요"), ("밥 먹었어요", "밤 머거써요"),
    ("있어요", "이써요"), ("국물", "궁물"), ("학교", "학꾜"), ("축하", "추카"), ("신라", "실라"),
    ("놓고", "노코"), ("앉아", "안자"), ("수박", "수박"), ("씨름", "씨름"), ("굳이", "구지"),
    ("딸기를 같이 먹어요", "딸기를 가치 머거요"), ("희망", "히망"), ("닫히다", "다치다"), ("옷", "옫"),
    ("침략", "침냑"), ("칼날", "칼랄"), ("싫어", "시러"), ("의자", "의자"),
])
def test_pronunciation(text, expected):
    assert sp(text) == expected

def test_phonemes_sagwa():
    assert [p.symbol for p in phonemes("사과")] == ["ㅅ", "ㅏ", "ㄱ", "ㅘ"]
    assert [p.pos for p in phonemes("밥")] == ["onset", "vowel", "coda"]
