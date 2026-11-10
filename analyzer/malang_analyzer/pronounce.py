"""표준발음법 규칙 엔진.

글자(철자)를 표준 발음 한글로 바꾸고, 소리(음소) 목록으로 나눈다.
g2pk 대신 쓰는 자체 구현이다. 형태소 정보가 필요한 예외(일부 된소리, 사이시옷 등)는
처리하지 않으므로, 검토된 고정본(LessonItem.pronunciation)을 우선 사용한다.
"""
from __future__ import annotations

from dataclasses import dataclass

ONSETS = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
VOWELS = list("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ")
CODAS = [""] + list("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")

BASE = 0xAC00

# 겹받침: (남는 받침, 뒤로 넘어가는 받침)
DOUBLE_CODA = {
    "ㄳ": ("ㄱ", "ㅅ"), "ㄵ": ("ㄴ", "ㅈ"), "ㄶ": ("ㄴ", "ㅎ"), "ㄺ": ("ㄹ", "ㄱ"),
    "ㄻ": ("ㄹ", "ㅁ"), "ㄼ": ("ㄹ", "ㅂ"), "ㄽ": ("ㄹ", "ㅅ"), "ㄾ": ("ㄹ", "ㅌ"),
    "ㄿ": ("ㄹ", "ㅍ"), "ㅀ": ("ㄹ", "ㅎ"), "ㅄ": ("ㅂ", "ㅅ"),
}
# 받침 대표음 (7종성)
NEUTRAL = {
    "ㄱ": "ㄱ", "ㄲ": "ㄱ", "ㅋ": "ㄱ", "ㄳ": "ㄱ", "ㄺ": "ㄱ",
    "ㄴ": "ㄴ", "ㄵ": "ㄴ", "ㄶ": "ㄴ",
    "ㄷ": "ㄷ", "ㅅ": "ㄷ", "ㅆ": "ㄷ", "ㅈ": "ㄷ", "ㅊ": "ㄷ", "ㅌ": "ㄷ", "ㅎ": "ㄷ",
    "ㄹ": "ㄹ", "ㄼ": "ㄹ", "ㄽ": "ㄹ", "ㄾ": "ㄹ", "ㅀ": "ㄹ",
    "ㅁ": "ㅁ", "ㄻ": "ㅁ",
    "ㅂ": "ㅂ", "ㅍ": "ㅂ", "ㅄ": "ㅂ", "ㄿ": "ㅂ",
    "ㅇ": "ㅇ", "": "",
}
TENSE = {"ㄱ": "ㄲ", "ㄷ": "ㄸ", "ㅂ": "ㅃ", "ㅅ": "ㅆ", "ㅈ": "ㅉ"}
ASPIRATE = {"ㄱ": "ㅋ", "ㄷ": "ㅌ", "ㅂ": "ㅍ", "ㅈ": "ㅊ"}
NASAL = {"ㄱ": "ㅇ", "ㄷ": "ㄴ", "ㅂ": "ㅁ"}


@dataclass
class Syl:
    onset: str  # "ㅇ" = 소리 없음
    vowel: str
    coda: str
    space_before: bool = False


def is_hangul(ch: str) -> bool:
    return BASE <= ord(ch) <= 0xD7A3


def decompose(ch: str) -> tuple[str, str, str]:
    code = ord(ch) - BASE
    return ONSETS[code // 588], VOWELS[(code % 588) // 28], CODAS[code % 28]


def compose(onset: str, vowel: str, coda: str) -> str:
    return chr(BASE + (ONSETS.index(onset) * 21 + VOWELS.index(vowel)) * 28 + CODAS.index(coda))


def to_syllables(text: str) -> list[Syl]:
    out: list[Syl] = []
    pending_space = False
    for ch in text:
        if is_hangul(ch):
            o, v, c = decompose(ch)
            out.append(Syl(o, v, c, pending_space and bool(out)))
            pending_space = False
        elif ch.isspace():
            pending_space = True
        # 문장부호·영문·숫자는 발음 비교에서 뺀다
    return out


def _apply_pair(a: Syl, b: Syl) -> None:
    """앞 음절 a의 받침과 뒤 음절 b의 첫소리 사이 규칙을 적용한다."""
    coda, onset = a.coda, b.onset
    if not coda:
        return

    # 1) ㅎ 받침 (놓고→노코, 좋아→조아, 놓는→논는, 싫어→시러, 좋소→조쏘)
    if coda in ("ㅎ", "ㄶ", "ㅀ"):
        keep = {"ㅎ": "", "ㄶ": "ㄴ", "ㅀ": "ㄹ"}[coda]
        if onset in ASPIRATE:
            a.coda, b.onset = keep, ASPIRATE[onset]
            return
        if onset == "ㅅ":
            a.coda, b.onset = keep, "ㅆ"
            return
        if onset == "ㅇ":
            a.coda = ""
            if keep:
                b.onset = keep
            return
        if onset == "ㄴ":
            a.coda = keep or "ㄴ"
            if keep == "ㄹ":
                b.onset = "ㄹ"
            return
        a.coda = keep or "ㄷ"
        coda = a.coda

    # 2) 거센소리되기 (축하→추카, 입학→이팍, 맏형→마텽)
    if onset == "ㅎ":
        rep = NEUTRAL.get(coda, coda)
        if coda in DOUBLE_CODA:
            left, right = DOUBLE_CODA[coda]
            if right in ASPIRATE:
                a.coda, b.onset = left, ASPIRATE[right]
                return
        if rep in ASPIRATE or coda in ("ㅈ", "ㅊ", "ㅅ"):
            base = "ㅈ" if coda in ("ㅈ", "ㅊ") else rep
            if coda == "ㄷ" and b.vowel == "ㅣ":  # 닫히다 → 다치다 (구개음화)
                a.coda, b.onset = "", "ㅊ"
                return
            a.coda, b.onset = "", ASPIRATE.get(base, "ㅌ")
            return

    # 3) 연음 + 구개음화 (같이→가치, 굳이→구지, 있어→이써, 앉아→안자)
    if onset == "ㅇ" and coda != "ㅇ":
        if coda in DOUBLE_CODA:
            left, right = DOUBLE_CODA[coda]
            a.coda, moved = left, right
        else:
            a.coda, moved = "", coda
        if moved == "ㄷ" and b.vowel == "ㅣ":
            moved = "ㅈ"
        elif moved == "ㅌ" and b.vowel == "ㅣ":
            moved = "ㅊ"
        b.onset = moved
        return

    # 4) 받침 대표음
    rep = NEUTRAL.get(coda, coda)
    if coda in DOUBLE_CODA and coda not in NEUTRAL:
        rep = DOUBLE_CODA[coda][0]
    a.coda = rep

    # 5) 비음화 (밥 먹→밤먹, 국물→궁물, 침략→침냑, 협력→혐녁)
    if rep in NASAL and onset in ("ㄴ", "ㅁ"):
        a.coda = NASAL[rep]
        return
    if onset == "ㄹ" and rep in ("ㅁ", "ㅇ"):
        b.onset = "ㄴ"
        return
    if onset == "ㄹ" and rep in NASAL:
        a.coda, b.onset = NASAL[rep], "ㄴ"
        return

    # 6) 유음화 (신라→실라, 칼날→칼랄)
    if rep == "ㄴ" and onset == "ㄹ":
        a.coda = "ㄹ"
        return
    if rep == "ㄹ" and onset == "ㄴ":
        b.onset = "ㄹ"
        return

    # 7) 된소리되기 (학교→학꾜, 국밥→국빱, 옷장→옫짱)
    if rep in ("ㄱ", "ㄷ", "ㅂ") and onset in TENSE:
        b.onset = TENSE[onset]


def _vowel_rules(syls: list[Syl]) -> None:
    for i, s in enumerate(syls):
        # 져·쪄·쳐 → 저·쩌·처
        if s.onset in ("ㅈ", "ㅉ", "ㅊ") and s.vowel == "ㅕ":
            s.vowel = "ㅓ"
        # 자음 뒤 ㅢ → ㅣ (희망→히망)
        if s.vowel == "ㅢ" and s.onset != "ㅇ":
            s.vowel = "ㅣ"


def standard_pronunciation(text: str) -> str:
    """철자를 표준 발음 한글로 바꾼다 (띄어쓰기는 유지)."""
    syls = to_syllables(text)
    for i in range(len(syls)):
        if i + 1 < len(syls):
            _apply_pair(syls[i], syls[i + 1])
        else:
            syls[i].coda = NEUTRAL.get(syls[i].coda, DOUBLE_CODA.get(syls[i].coda, (syls[i].coda,))[0])
    _vowel_rules(syls)
    out = []
    for s in syls:
        if s.space_before:
            out.append(" ")
        out.append(compose(s.onset, s.vowel, s.coda))
    return "".join(out)


@dataclass
class Phoneme:
    symbol: str
    pos: str  # onset | vowel | coda
    syl: int  # 몇 번째 음절인지 (0부터)

    def as_dict(self) -> dict:
        return {"symbol": self.symbol, "pos": self.pos, "syl": self.syl}


def phonemes(pronounced: str) -> list[Phoneme]:
    """발음 한글을 소리 목록으로 나눈다. 첫소리 ㅇ은 소리가 없어서 뺀다."""
    out: list[Phoneme] = []
    for i, s in enumerate(to_syllables(pronounced)):
        if s.onset != "ㅇ":
            out.append(Phoneme(s.onset, "onset", i))
        out.append(Phoneme(s.vowel, "vowel", i))
        if s.coda:
            out.append(Phoneme(s.coda, "coda", i))
    return out


def syllable_texts(text: str) -> list[str]:
    return [ch for ch in text if is_hangul(ch)]
