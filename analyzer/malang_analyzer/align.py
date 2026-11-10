"""정답 소리와 들린 소리를 편집거리로 정렬한다.

결과 종류: same(같음) · allowed(허용 발음) · sub(바뀜) · del(빠짐) · ins(더해짐) · unsure(확실하지 않음)
"""
from __future__ import annotations

from .pronounce import Phoneme, phonemes

# 디자인 Stimuli 3장 "채점 규칙 · 틀린 게 아닌 것"
ALLOWED = [
    {"ㅐ", "ㅔ"},
    {"ㅒ", "ㅖ"},
    {"ㅙ", "ㅚ", "ㅞ"},
]


def _allowed(target: Phoneme, got: Phoneme, target_first_syl: bool) -> bool:
    if target.pos != got.pos:
        return False
    for group in ALLOWED:
        if target.symbol in group and got.symbol in group:
            return True
    # ㅢ: 첫음절 [의] · 그 외 [이] 허용 · 조사 [에] 허용
    if target.symbol == "ㅢ" and got.symbol in ("ㅣ", "ㅔ") and not target_first_syl:
        return True
    # ㅖ: ㅇ·ㄹ 외의 자음 뒤에서는 [ㅔ] 허용 (시계→시게)
    if target.symbol == "ㅖ" and got.symbol == "ㅔ":
        return True
    # 모음 사이 ㅎ 약화·탈락은 정렬 단계에서 처리 (_weak_h)
    return False


def _cost_sub(a: Phoneme, b: Phoneme) -> float:
    if a.symbol == b.symbol and a.pos == b.pos:
        return 0.0
    a_vowel, b_vowel = a.pos == "vowel", b.pos == "vowel"
    if a_vowel != b_vowel:
        return 2.5  # 자음과 모음은 잘 맞추지 않는다
    if a.symbol == b.symbol:
        return 0.3  # 같은 자음, 위치만 다름 (받침↔첫소리)
    return 1.0


def _weak_h(t: Phoneme, target: list[Phoneme], i: int) -> bool:
    """모음 사이 ㅎ (오후, 은행 등) 은 빠져도 틀리지 않게 본다."""
    if t.symbol != "ㅎ" or t.pos != "onset" or i == 0:
        return False
    prev = target[i - 1]
    return prev.pos == "vowel" or prev.symbol in ("ㄴ", "ㅁ", "ㅇ", "ㄹ")


def align(target: list[Phoneme], got: list[Phoneme]) -> list[dict]:
    n, m = len(target), len(got)
    dp = [[0.0] * (m + 1) for _ in range(n + 1)]
    bt = [[""] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        dp[i][0] = dp[i - 1][0] + (0.2 if _weak_h(target[i - 1], target, i - 1) else 1.0)
        bt[i][0] = "D"
    for j in range(1, m + 1):
        dp[0][j] = dp[0][j - 1] + 1.0
        bt[0][j] = "I"
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            t, g = target[i - 1], got[j - 1]
            sub = 0.0 if _allowed(t, g, t.syl == 0) else _cost_sub(t, g)
            dele = 0.2 if _weak_h(t, target, i - 1) else 1.0
            choices = [(dp[i - 1][j - 1] + sub, "S"), (dp[i - 1][j] + dele, "D"), (dp[i][j - 1] + 1.0, "I")]
            dp[i][j], bt[i][j] = min(choices, key=lambda x: x[0])

    ops: list[dict] = []
    i, j = n, m
    while i > 0 or j > 0:
        move = bt[i][j]
        if move == "S":
            t, g = target[i - 1], got[j - 1]
            if t.symbol == g.symbol and t.pos == g.pos:
                kind = "same"
            elif _allowed(t, g, t.syl == 0):
                kind = "allowed"
            else:
                kind = "sub"
            ops.append({"target": t.as_dict(), "got": g.as_dict(), "type": kind})
            i, j = i - 1, j - 1
        elif move == "D":
            t = target[i - 1]
            kind = "allowed" if _weak_h(t, target, i - 1) else "del"
            ops.append({"target": t.as_dict(), "got": None, "type": kind})
            i -= 1
        else:
            ops.append({"target": None, "got": got[j - 1].as_dict(), "type": "ins"})
            j -= 1
    ops.reverse()
    return ops


def compare(target_pron: str, heard_pron: str | None) -> dict:
    """정답 발음과 들린 발음을 비교해 화면에 쓸 결과를 만든다."""
    t = phonemes(target_pron)
    if not heard_pron:
        return {
            "ops": [{"target": p.as_dict(), "got": None, "type": "unsure"} for p in t],
            "matched": 0,
            "total": len(t),
            "diffRatio": None,
        }
    g = phonemes(heard_pron)
    ops = align(t, g)
    total = len(t)
    matched = sum(1 for o in ops if o["target"] and o["type"] in ("same", "allowed"))
    # 다른 말 판정은 정답 소리 기준 (끝에 소리가 더 붙은 것만으로 '다른 말'이 되지 않게)
    wrong = sum(1 for o in ops if o["target"] and o["type"] in ("sub", "del"))
    inserted = sum(1 for o in ops if o["type"] == "ins")
    return {
        "ops": ops,
        "matched": matched,
        "total": total,
        "inserted": inserted,
        "diffRatio": round(wrong / max(total, 1), 3),
    }


def sound_verdicts(ops: list[dict], sounds: list[str]) -> dict[str, bool | None]:
    """각 목표 소리가 문항 안에서 모두 맞았는지. 문항에 없는 소리는 None."""
    out: dict[str, bool | None] = {}
    for s in sounds:
        hits = [o for o in ops if o["target"] and o["target"]["symbol"] == s]
        if not hits:
            out[s] = None
        elif any(o["type"] == "unsure" for o in hits):
            out[s] = None
        else:
            out[s] = all(o["type"] in ("same", "allowed") for o in hits)
    return out
