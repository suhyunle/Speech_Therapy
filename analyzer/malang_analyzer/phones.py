"""소리 단위(음소) 인식 — Allosaurus(uni2005, 다국어 음소 인식 모델)를 numpy 만으로 돌린다.

받아쓰기(단어 인식)는 '아는 단어'로 맞춰 적는 경향이 있어서, 소리 하나하나를 직접 보는 모델을 따로 둔다.
- 원본: https://github.com/xinjli/allosaurus (GPL-3.0) · 모델 uni2005 (BiLSTM 5층, 230개 국제음성기호)
- torch 없이 돌리려고 가중치를 npz 로 바꿔 쓴다 (scripts/convert_allosaurus.py)
- 한국어 음소 목록(kore1280)으로 출력을 제한한다 → 평음·격음·경음(ㄱ/ㅋ/ㄲ)을 구별하는 목록이 들어 있다

이 모델은 한국어로 학습하지 않았다(영·중·독·러 등 14개 언어). 한국어 소리를 '국제음성기호로' 들은 결과라서
정확도가 높지 않다 → 판정을 뒤집지 않고, 받아쓰기와 크게 다를 때 '확실하지 않음'으로 보류하는 데만 쓴다.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import numpy as np

SR = 8000
MODEL_DIR = os.environ.get("PHONE_MODEL_DIR", str(Path(__file__).resolve().parents[2] / "models" / "allosaurus" / "uni2005"))


# ---------- 특징 (allosaurus pm/mfcc_hires 과 같은 계산) ----------

def _resample_16k_to_8k(x: np.ndarray) -> np.ndarray:
    # 창을 씌운 sinc 저역 통과(3.8kHz) 후 2:1 솎아내기
    n = 63
    t = np.arange(n) - (n - 1) / 2
    fc = 3800 / 16000
    h = 2 * fc * np.sinc(2 * fc * t) * np.kaiser(n, 8.0)
    h /= h.sum()
    y = np.convolve(x, h, mode="same")
    return y[::2]


def _mel(hz):
    return 1127 * np.log(1 + hz / 700.0)


@lru_cache(maxsize=1)
def _filterbank(nfilt=40, nfft=256, sr=SR, low=40, high=3800):
    lowmel, highmel = _mel(low), _mel(high)
    fb = np.zeros([nfilt, nfft // 2 + 1])
    d = (highmel - lowmel) / (nfilt + 1)
    mels = _mel(np.arange(nfft // 2) * sr / nfft)
    for j in range(nfilt):
        l, c, r = lowmel + j * d, lowmel + (j + 1) * d, lowmel + (j + 2) * d
        up = (mels > l) & (mels < c)
        dn = (mels >= c) & (mels < r)
        fb[j, : nfft // 2][up] = (mels[up] - l) / (c - l)
        fb[j, : nfft // 2][dn] = (r - mels[dn]) / (r - c)
    return fb


@lru_cache(maxsize=1)
def _dct_matrix(n=40):
    k = np.arange(n)[:, None]
    i = np.arange(n)[None, :]
    m = np.cos(np.pi * k * (2 * i + 1) / (2 * n)) * np.sqrt(2 / n)
    m[0] /= np.sqrt(2)
    return m  # ortho DCT-II


def features(x16k: np.ndarray) -> np.ndarray:
    """16kHz 녹음 → (T/3, 120) 특징 (MFCC 40 · 화자 정규화 · 앞뒤 프레임 이어붙여 1/3 솎기)"""
    x = _resample_16k_to_8k(x16k.astype(np.float64)) * 32768.0
    flen, fstep, nfft = 200, 80, 256
    nframes = 1 if len(x) <= flen else 1 + (len(x) - flen) // fstep
    x = x[: (nframes - 1) * fstep + flen]
    if len(x) < flen:
        x = np.pad(x, (0, flen - len(x)))
    idx = np.arange(flen)[None, :] + fstep * np.arange(nframes)[:, None]
    frames = x[idx]
    frames = frames - frames.mean(axis=1, keepdims=True)
    frames = np.concatenate([(1 - 0.97) * frames[:, :1], frames[:, 1:] - 0.97 * frames[:, :-1]], axis=1)
    frames = frames * np.hamming(flen)
    pspec = np.abs(np.fft.rfft(frames, nfft)) ** 2
    feat = pspec @ _filterbank().T
    feat = np.where(feat == 0, np.finfo(float).eps, feat)
    feat = np.log(feat) @ _dct_matrix().T
    n = np.arange(40)
    feat = feat * (1 + 11.0 * np.sin(np.pi * n / 22))
    mu = feat.mean(axis=0)
    sd = np.sqrt(np.maximum((feat * feat).mean(axis=0) - mu * mu, 1e-12))
    feat = (feat - mu) / sd
    feat = np.concatenate([np.roll(feat, 1, axis=0), feat, np.roll(feat, -1, axis=0)], axis=1)[::3]
    return feat.astype(np.float32)


# ---------- 모델 (BiLSTM 5층 + 선형층) ----------

class PhoneModel:
    def __init__(self, model_dir: str = MODEL_DIR):
        d = Path(model_dir)
        w = np.load(d / "allosaurus_uni2005.npz")
        self.w = {k: w[k] for k in w.files}
        self.units = ["<blk>"] + [line.split()[0] for line in (d / "phone.txt").read_text(encoding="utf-8").splitlines() if line.strip()]
        kor = [line.split()[0] for line in (d / "inventory" / "kore1280.txt").read_text(encoding="utf-8").splitlines() if line.strip()]
        self.kor_ids = np.array([0] + [self.units.index(p) for p in kor if p in self.units])
        self.kor_units = [self.units[i] for i in self.kor_ids]

    @staticmethod
    def _sig(x):
        return 1 / (1 + np.exp(-x))

    def _lstm(self, x, l: int, reverse: bool):
        s = "_reverse" if reverse else ""
        Wi, Wh = self.w[f"blstm_layer.weight_ih_l{l}{s}"], self.w[f"blstm_layer.weight_hh_l{l}{s}"]
        b = self.w[f"blstm_layer.bias_ih_l{l}{s}"] + self.w[f"blstm_layer.bias_hh_l{l}{s}"]
        H = Wh.shape[1]
        gx = x @ Wi.T + b  # (T, 4H) — 입력 쪽은 한 번에 계산
        h = np.zeros(H, np.float32)
        c = np.zeros(H, np.float32)
        out = np.zeros((len(x), H), np.float32)
        order = range(len(x) - 1, -1, -1) if reverse else range(len(x))
        WhT = Wh.T
        for t in order:
            g = gx[t] + h @ WhT
            i, f, gg, o = self._sig(g[:H]), self._sig(g[H : 2 * H]), np.tanh(g[2 * H : 3 * H]), self._sig(g[3 * H :])
            c = f * c + i * gg
            h = o * np.tanh(c)
            out[t] = h
        return out

    def logits(self, feat: np.ndarray) -> np.ndarray:
        x = feat
        for l in range(5):
            x = np.concatenate([self._lstm(x, l, False), self._lstm(x, l, True)], axis=1)
        return x @ self.w["phone_layer.weight"].T + self.w["phone_layer.bias"]

    def korean_logprobs(self, x16k: np.ndarray) -> np.ndarray:
        """(T, K) 한국어 음소 목록만 남긴 log 확률. 한 프레임 = 30ms"""
        z = self.logits(features(x16k))[:, self.kor_ids].astype(np.float64)
        z -= z.max(axis=1, keepdims=True)
        return z - np.log(np.exp(z).sum(axis=1, keepdims=True))

    def greedy(self, lp: np.ndarray) -> list[tuple[str, int]]:
        out, prev = [], -1
        for t, a in enumerate(lp.argmax(axis=1)):
            if a != prev and a != 0:
                out.append((self.kor_units[a], t))
            prev = a
        return out


@lru_cache(maxsize=1)
def get_phone_model() -> PhoneModel | None:
    try:
        return PhoneModel()
    except (FileNotFoundError, OSError):
        return None


# ---------- 목표 소리에 맞춰 정렬하고 소리마다 확인 ----------

# 한글 소리 → 음소 모델 기호 무리. 이 모델로 구별되는 것만 나눈다:
# 평음·경음(ㄱ/ㄲ)은 둘 다 같은 기호라 한 무리, 격음(ㅋ)만 따로.
CLASSES: dict[str, set[str]] = {
    "K": {"k"}, "KH": {"kʰ"}, "T": {"t", "t̪"}, "TH": {"tʰ", "t̪ʰ"}, "P": {"p", "b"}, "PH": {"pʰ"},
    "S": {"s", "s̪", "ʃ", "ɕ"}, "H": {"h"}, "M": {"m"}, "N": {"n", "n̪"}, "NG": {"ŋ"}, "L": {"l", "lː", "ɾ"},
    "A": {"a", "aː", "ɐ"}, "EO": {"ʌ", "ɤ"}, "O": {"o", "oː"}, "U": {"u", "uː"}, "EU": {"ɨ", "ɯ"}, "I": {"i", "iː", "ɪ"},
    "E": {"e", "eː", "e̞", "ɛ", "æ"}, "OE": {"ø"}, "Y": {"y"}, "J": {"j"}, "W": {"w"},
}
ONSET = {"ㄱ": "K", "ㄲ": "K", "ㅋ": "KH", "ㄷ": "T", "ㄸ": "T", "ㅌ": "TH", "ㅂ": "P", "ㅃ": "P", "ㅍ": "PH",
         "ㅅ": "S", "ㅆ": "S", "ㅎ": "H", "ㅁ": "M", "ㄴ": "N", "ㄹ": "L",
         # ㅈ·ㅊ 은 이 모델 목록에 ‘츠’ 소리가 없어 ㄷ·ㅅ 사이로 나온다 → 정렬에만 쓰고 판정하지 않는다
         "ㅈ": "T|S", "ㅉ": "T|S", "ㅊ": "TH|S"}
CODA = {"ㄱ": "K", "ㄷ": "T", "ㅂ": "P", "ㅁ": "M", "ㄴ": "N", "ㅇ": "NG", "ㄹ": "L"}
VOWEL = {"ㅏ": ["A"], "ㅓ": ["EO"], "ㅗ": ["O"], "ㅜ": ["U"], "ㅡ": ["EU"], "ㅣ": ["I"], "ㅔ": ["E"], "ㅐ": ["E"],
         "ㅑ": ["J", "A"], "ㅕ": ["J", "EO"], "ㅛ": ["J", "O"], "ㅠ": ["J", "U"], "ㅒ": ["J", "E"], "ㅖ": ["J", "E"],
         "ㅘ": ["W", "A"], "ㅝ": ["W", "EO"], "ㅙ": ["W", "E"], "ㅞ": ["W", "E"], "ㅚ": ["W", "E"], "ㅟ": ["W", "I"], "ㅢ": ["EU", "I"]}
# 서로 헷갈리는지 볼 짝 (이 짝 안에서만 ‘다른 소리’라고 본다)
# 바른 한국어 녹음(모델 시험용 4문장, 152소리)으로 재 보니 잘못 걸리는 것:
#  - 낱말 첫 평음(다리의 ㄷ)은 원래 숨이 조금 섞여 ㅌ처럼 잡힘 → 낱말 첫소리에서는 평음·격음을 보지 않는다
#  - 모음(ㅓ/ㅗ, ㅜ/ㅡ)과 ㄹ/ㄴ 은 바른 발음도 자주 엇갈림 → 보지 않는다
RIVALS = {"K": ["KH"], "KH": ["K"], "T": ["TH", "S"], "TH": ["T", "S"], "P": ["PH"], "PH": ["P"], "S": ["T", "TH"]}
ASPIRATION = {("K", "KH"), ("KH", "K"), ("T", "TH"), ("TH", "T"), ("P", "PH"), ("PH", "P")}
CLASS_TO_JAMO = {"K": "ㄱ", "KH": "ㅋ", "T": "ㄷ", "TH": "ㅌ", "P": "ㅂ", "PH": "ㅍ", "S": "ㅅ", "L": "ㄹ", "N": "ㄴ", "M": "ㅁ",
                 "EO": "ㅓ", "O": "ㅗ", "U": "ㅜ", "EU": "ㅡ"}


def _class_scores(lp: np.ndarray, units: list[str]) -> dict[str, np.ndarray]:
    out = {}
    for name, us in CLASSES.items():
        idx = [i for i, u in enumerate(units) if u in us]
        out[name] = np.logaddexp.reduce(lp[:, idx], axis=1) if idx else np.full(len(lp), -1e9)
    return out


def target_tokens(phs, word_start: set[int] | None = None) -> list[dict]:
    """소리 목록(pronounce.phonemes) → 정렬용 토큰. 각 토큰은 어느 소리에서 왔는지 기억한다.
    word_start: 낱말이 시작하는 음절 번호들 (첫 음절 포함)"""
    toks = []
    ws = word_start if word_start is not None else {0}
    for k, p in enumerate(phs):
        if p.pos == "vowel":
            for c in VOWEL.get(p.symbol, []):
                toks.append({"cls": c, "ph": k, "judge": c not in ("J", "W")})
        else:
            c = (ONSET if p.pos == "onset" else CODA).get(p.symbol)
            if c:
                toks.append({"cls": c, "ph": k, "judge": "|" not in c, "initial": p.pos == "onset" and p.syl in ws})
    return toks


def _tok_score(cs: dict[str, np.ndarray], cls: str) -> np.ndarray:
    parts = cls.split("|")
    return np.logaddexp.reduce(np.stack([cs[c] for c in parts]), axis=0) if len(parts) > 1 else cs[cls]


def force_align(lp: np.ndarray, units: list[str], toks: list[dict]):
    """CTC Viterbi 강제 정렬: 목표 토큰 순서대로 프레임을 나눈다. 프레임이 모자라면 None."""
    T, N = len(lp), len(toks)
    if N == 0 or T < N:
        return None
    cs = _class_scores(lp, units)
    blank = lp[:, 0]
    emit = np.stack([_tok_score(cs, t["cls"]) for t in toks])  # (N, T)
    S = 2 * N + 1  # blank, t0, blank, t1, ..., blank
    NEG = -1e18
    dp = np.full((T, S), NEG)
    bp = np.zeros((T, S), dtype=np.int8)
    def e(t, s):
        return blank[t] if s % 2 == 0 else emit[s // 2, t]
    dp[0, 0] = e(0, 0)
    dp[0, 1] = e(0, 1)
    for t in range(1, T):
        for s in range(S):
            best, arg = dp[t - 1, s], 0
            if s >= 1 and dp[t - 1, s - 1] > best:
                best, arg = dp[t - 1, s - 1], 1
            if s >= 2 and s % 2 == 1 and toks[s // 2]["cls"] != toks[s // 2 - 1]["cls"] and dp[t - 1, s - 2] > best:
                best, arg = dp[t - 1, s - 2], 2
            dp[t, s] = best + e(t, s)
            bp[t, s] = arg
    s = S - 1 if dp[T - 1, S - 1] >= dp[T - 1, S - 2] else S - 2
    path = [0] * T
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(bp[t, s])
    segs = [[] for _ in range(N)]
    for t, s in enumerate(path):
        if s % 2 == 1:
            segs[s // 2].append(t)
    return cs, segs


# 경쟁 소리가 목표보다 평균 이만큼(자연로그) 더 그럴듯하고, 프레임 절반 넘게 이기면 ‘다르게 들림’
GOP_MARGIN = 1.5


def check_phonemes(x16k: np.ndarray, phs, model: PhoneModel | None = None, word_start: set[int] | None = None) -> list[dict] | None:
    """목표 소리마다 음소 모델이 본 결과. [{ph, cls, gop, rival, rivalJamo, frames}]  (판정하는 소리만)"""
    m = model or get_phone_model()
    if m is None:
        return None
    lp = m.korean_logprobs(x16k)
    toks = target_tokens(phs, word_start)
    r = force_align(lp, m.kor_units, toks)
    if r is None:
        return None
    cs, segs = r
    out = []
    for tok, seg in zip(toks, segs):
        if not tok["judge"] or not seg or tok["cls"] not in RIVALS:
            continue
        mine = cs[tok["cls"]][seg]
        best_rival, best_gap, wins = None, -1e9, 0
        for rv in RIVALS.get(tok["cls"], []):
            if tok.get("initial") and (tok["cls"], rv) in ASPIRATION:
                continue
            gap = float(np.mean(cs[rv][seg] - mine))
            if gap > best_gap:
                best_rival, best_gap, wins = rv, gap, int(np.sum(cs[rv][seg] > mine))
        out.append({
            "ph": tok["ph"], "cls": tok["cls"], "frames": len(seg),
            "rival": best_rival, "gap": round(best_gap, 2) if best_rival else None,
            "heardAs": CLASS_TO_JAMO.get(best_rival) if best_rival and best_gap > GOP_MARGIN and wins * 2 > len(seg) else None,
        })
    return out
