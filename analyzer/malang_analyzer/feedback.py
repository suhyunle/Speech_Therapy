"""피드백 규칙 (디자인 메모 '응원 규칙 · 언제 무슨 말을 하나').

근거 없는 칭찬은 쓰지 않는다. 잘한 것 먼저 → 고칠 것 하나. '실패'라는 말은 쓰지 않는다.
문구는 상황마다 여러 개를 돌려 쓴다 (같은 말이 연달아 나오지 않게 seed로 고른다).
"""
from __future__ import annotations

ISSUE_TEXT = {
    "too_quiet": ("소리가 너무 작았어요", "휴대폰을 입에서 한 뼘 거리로, 평소보다 조금 더 크게 말해요"),
    "noisy": ("주변이 시끄러워요", "조용한 곳에서 다시 녹음해요"),
    "too_short": ("말소리가 너무 짧았어요", "끝까지 이어서 말해요"),
    "clipped": ("소리가 너무 커서 깨졌어요", "조금 떨어져서 말해요"),
    "mismatch": ("다른 말처럼 들렸어요", "정답 단어를 보고 다시 말해요"),
    "no_speech": ("말소리를 찾지 못했어요", "마이크에 대고 다시 말해요"),
}

TIPS = {
    "ㅅ": "혀끝을 윗잇몸 바로 아래에 두고, 닿지 않게 틈으로 바람을 길게",
    "ㅆ": "ㅅ보다 목에 힘을 주고 바람을 세게, 짧고 단단하게",
    "ㄷ": "혀끝을 윗잇몸에 붙였다가 떼요",
    "ㅌ": "혀끝을 붙였다가 떼면서 바람을 세게 터뜨려요",
    "ㄸ": "혀끝을 붙이고 목에 힘을 준 채 바람 없이 떼요",
    "ㄱ": "혀 뒤쪽을 입천장 안쪽에 붙였다가 떼요",
    "ㅋ": "혀 뒤를 붙였다가 바람을 세게 터뜨려요",
    "ㄲ": "혀 뒤를 붙이고 목에 힘을 준 채 바람 없이 떼요",
    "ㅂ": "두 입술을 붙였다가 떼요",
    "ㅍ": "입술을 붙였다가 손바닥에 바람이 닿게 터뜨려요",
    "ㅃ": "입술을 꽉 붙이고 바람 없이 단단하게 떼요",
    "ㅈ": "혀를 잇몸 뒤에 붙였다가 살짝 떼며 바람을 흘려요",
    "ㅊ": "ㅈ처럼 붙였다가 바람을 세게 내보내요",
    "ㅉ": "ㅈ처럼 붙이고 목에 힘을 준 채 바람 없이",
    "ㅁ": "입술을 다물고 코로 소리를 내요 · 콧등이 떨려요",
    "ㄴ": "혀끝을 윗잇몸에 대고 코로 소리를 내요",
    "ㅇ": "혀 뒤를 입천장 안쪽에 대고 코로 소리를 내요",
    "ㄹ": "혀끝을 윗잇몸에 살짝 튕기거나, 받침이면 붙인 채 옆으로 소리를",
    "ㅎ": "입을 벌리고 목에서 바람만 내보내요",
    "ㅏ": "입을 크게 벌리고 혀를 아래로",
    "ㅓ": "입을 ㅏ보다 조금 덜 벌리고 입술은 둥글게 하지 않아요",
    "ㅗ": "입술을 동그랗게 모으고 앞으로",
    "ㅜ": "입술을 더 작게 모아 앞으로 쭉",
    "ㅡ": "입술을 옆으로 펴고 혀를 가운데로",
    "ㅣ": "입술을 옆으로 펴고 혀를 앞쪽 위로",
    "ㅔ": "입을 조금 벌리고 혀를 앞으로",
    "ㅐ": "입을 조금 벌리고 혀를 앞으로",
}

CHEER_DONE = [
    "끝까지 말했어요!",
    "좋아요, 끝까지 이어서 말했어요",
    "한 번 더 해냈어요!",
    "말한 것부터 잘했어요!",
    "이번에도 끝까지 말했어요",
]
ISSUE_CHEER = {
    "too_quiet": "괜찮아요, 소리 크기만 맞추면 돼요 · 이번 녹음은 횟수에 세지 않아요",
    "clipped": "괜찮아요, 거리만 맞추면 돼요 · 이번 녹음은 횟수에 세지 않아요",
    "noisy": "괜찮아요, 자리만 옮기면 돼요 · 이번 녹음은 횟수에 세지 않아요",
}
CHEER_RETRY = [
    "괜찮아요, 한 번만 다시 해볼까요",
    "괜찮아요, 바꿀 것 하나만 알려드릴게요",
    "괜찮아요, 다시 하면 돼요",
    "녹음만 다시 하면 돼요",
]


def pick(options: list[str], seed: int) -> str:
    return options[seed % len(options)]


def build(compare: dict | None, issue: str | None, target_sounds: list[str], seed: int) -> dict:
    if issue:
        title, tip = ISSUE_TEXT.get(issue, ISSUE_TEXT["no_speech"])
        return {"headline": title, "cheer": ISSUE_CHEER.get(issue, pick(CHEER_RETRY, seed)), "tip": tip, "next": "retry"}
    if not compare or compare["diffRatio"] is None:
        return {
            "headline": "들린 소리를 확실하게 알 수 없었어요",
            "cheer": pick(CHEER_DONE, seed),
            "tip": "조금 더 또박또박, 끝까지 이어서 말해요",
            "next": "retry",
        }
    ops = compare["ops"]
    wrong = [o for o in ops if o["type"] in ("sub", "del") and o["target"]]
    good = compare["matched"]
    total = compare["total"]
    if not wrong and compare.get("inserted"):
        return {
            "headline": f"{total}소리 모두 났어요 · 뒤에 소리가 조금 더 붙었어요",
            "cheer": pick(CHEER_DONE, seed),
            "tip": "정답 단어까지만 말하고 멈춰요",
            "next": "continue",
        }
    if not wrong:
        return {
            "headline": f"{total}소리 모두 통과!",
            "cheer": pick(CHEER_DONE, seed),
            "tip": None,
            "next": "continue",
        }
    first = wrong[0]
    t = first["target"]["symbol"]
    if first["type"] == "sub":
        g = first["got"]["symbol"]
        headline = f"{t}이 {g}처럼 났어요" if _has_batchim(t) else f"{t}가 {g}처럼 났어요"
    else:
        headline = f"{t} 소리가 빠졌어요"
    focus = next((s for s in target_sounds if s == t), t)
    return {
        "headline": headline,
        "cheer": f"{total}소리 중 {good}개 통과! {focus}만 조금 더",
        "tip": TIPS.get(t),
        "next": f"lesson:{t}",
    }


def _has_batchim(jamo: str) -> bool:
    """자모 이름 끝에 받침이 있는지(조사 이/가 고르기). ㄱ(기역) ㄴ(니은) ... 모음은 받침 없음."""
    names_with_final = set("ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㄲㄸㅃㅆㅉ")
    return jamo in names_with_final
