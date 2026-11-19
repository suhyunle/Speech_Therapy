"""한국어 받아쓰기 모델(Zipformer 트랜스듀서)로 ‘이 글자였을 가능성’을 직접 계산한다.

받아쓰기는 가장 그럴듯한 한 줄만 내놓지만, 같은 모델로 정해진 글자열의 점수(로그 확률)를 셀 수 있다.
목표 낱말과, 소리 하나만 바꾼 짝 낱말(가→카·까, 서→소 …)의 점수를 비교하면 한국어로 학습한 모델로 소리 하나를 판정할 수 있다.
- 모델 안의 ‘말뭉치 습관’(아는 단어 쪽으로 기우는 것)은 내부 언어모델 점수를 빼서 줄인다 (ILM 보정)
- 판정은 낱말 구간만 잘라서 한다 → 긴 문장도 빠르다
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import numpy as np

MODEL_DIR = os.environ.get("ASR_MODEL_DIR", str(Path(__file__).resolve().parents[2] / "models" / "sherpa-onnx-zipformer-korean-2024-06-24"))


class RnntScorer:
    def __init__(self, model_dir: str = MODEL_DIR, threads: int = 2):
        import onnxruntime as ort
        import sentencepiece as spm

        d = Path(model_dir)
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1
        pick = lambda pat: str(next(iter(sorted(d.glob(pat)))))
        self.enc = ort.InferenceSession(pick("encoder-*.onnx"), so, providers=["CPUExecutionProvider"])
        self.dec = ort.InferenceSession(pick("decoder-*.onnx"), so, providers=["CPUExecutionProvider"])
        self.joi = ort.InferenceSession(pick("joiner-*.onnx"), so, providers=["CPUExecutionProvider"])
        self.sp = spm.SentencePieceProcessor(model_file=str(d / "bpe.model"))
        self.ctx = int(self.dec.get_modelmeta().custom_metadata_map.get("context_size", 2))
        self.blank = 0

    # ---------- 특징과 인코더 ----------
    def encode(self, x16k: np.ndarray) -> np.ndarray:
        import kaldi_native_fbank as knf

        o = knf.FbankOptions()
        o.frame_opts.samp_freq = 16000
        o.frame_opts.dither = 0
        o.frame_opts.snip_edges = False
        o.mel_opts.num_bins = 80
        o.mel_opts.high_freq = -400
        fb = knf.OnlineFbank(o)
        fb.accept_waveform(16000, x16k.astype(np.float32).tolist())
        fb.input_finished()
        feats = np.stack([fb.get_frame(i) for i in range(fb.num_frames_ready)]).astype(np.float32)
        out, lens = self.enc.run(None, {"x": feats[None], "x_lens": np.array([len(feats)], dtype=np.int64)})
        return out[0, : int(lens[0])]

    # ---------- 디코더 · 조이너 ----------
    def _dec(self, ctxs: np.ndarray) -> np.ndarray:
        return self.dec.run(None, {"y": ctxs.astype(np.int64)})[0]

    def _joint_logprobs(self, enc: np.ndarray, dec: np.ndarray) -> np.ndarray:
        """enc (T, D), dec (U, D) → (T, U, V) log-softmax"""
        T, U = len(enc), len(dec)
        e = np.repeat(enc, U, axis=0)
        d = np.tile(dec, (T, 1))
        z = self.joi.run(None, {"encoder_out": e, "decoder_out": d})[0].astype(np.float64)
        z -= z.max(axis=1, keepdims=True)
        z -= np.log(np.exp(z).sum(axis=1, keepdims=True))
        return z.reshape(T, U, -1)

    def _contexts(self, history: list[int], ys: list[int]) -> np.ndarray:
        seq = [self.blank] * self.ctx + history + ys
        start = self.ctx + len(history)
        return np.array([seq[start + u - self.ctx : start + u] for u in range(len(ys) + 1)])

    def greedy(self, enc: np.ndarray) -> str:
        hyp: list[int] = []
        for t in range(len(enc)):
            for _ in range(5):
                ctx = np.array([([self.blank] * self.ctx + hyp)[-self.ctx :]])
                lp = self._joint_logprobs(enc[t : t + 1], self._dec(ctx))[0, 0]
                k = int(lp.argmax())
                if k == self.blank:
                    break
                hyp.append(k)
        return self.sp.decode(hyp)

    def score(self, enc: np.ndarray, ys: list[int], history: list[int] | None = None, ilm_weight: float = 0.0) -> float:
        """정해진 토큰열 ys 의 로그 확률 (트랜스듀서 격자 전방 계산). history: 앞 낱말의 토큰 (디코더 문맥)"""
        hist = history or []
        ctxs = self._contexts(hist, ys)
        dec = self._dec(ctxs)
        lp = self._joint_logprobs(enc, dec)  # (T, U+1, V)
        T, U = len(enc), len(ys)
        blank = lp[:, :, self.blank]
        emit = np.stack([lp[:, u, ys[u]] for u in range(U)], axis=1) if U else np.zeros((T, 0))
        # alpha(t,u) = log P(첫 u 토큰을 내고 t 프레임에 있음). 끝은 마지막 프레임에서 빈칸으로 마침
        a = np.full((T, U + 1), -np.inf)
        a[0, 0] = 0.0
        for u in range(1, U + 1):
            a[0, u] = a[0, u - 1] + emit[0, u - 1]
        for t in range(1, T):
            a[t, 0] = a[t - 1, 0] + blank[t - 1, 0]
            for u in range(1, U + 1):
                a[t, u] = np.logaddexp(a[t - 1, u] + blank[t - 1, u], a[t, u - 1] + emit[t, u - 1])
        total = a[T - 1, U] + blank[T - 1, U]
        if ilm_weight and U:
            # 내부 언어모델: 인코더 입력을 0 으로 두고 디코더만으로 다음 토큰을 맞힐 확률 (빈칸 빼고 다시 정규화)
            z = self.joi.run(None, {"encoder_out": np.zeros_like(dec), "decoder_out": dec})[0].astype(np.float64)
            z[:, self.blank] = -np.inf
            z -= z.max(axis=1, keepdims=True)
            z -= np.log(np.exp(z).sum(axis=1, keepdims=True))
            total -= ilm_weight * float(sum(z[u, ys[u]] for u in range(U)))
        return float(total)

    def tokens(self, text: str) -> list[int]:
        return self.sp.encode(text)


@lru_cache(maxsize=1)
def get_scorer() -> RnntScorer | None:
    try:
        return RnntScorer()
    except Exception:
        return None


# ---------- 낱말 구간에서 소리 하나 바꾼 짝과 비교 ----------

CHO = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
JUNG = list("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ")
ONSET_RIVALS = {
    "ㄱ": "ㄲㅋ", "ㄲ": "ㄱㅋ", "ㅋ": "ㄱㄲ", "ㄷ": "ㄸㅌㅅ", "ㄸ": "ㄷㅌㅆ", "ㅌ": "ㄷㄸㅅ", "ㅂ": "ㅃㅍㅁ", "ㅃ": "ㅂㅍ", "ㅍ": "ㅂㅃ",
    "ㅅ": "ㅆㄷㅈ", "ㅆ": "ㅅ", "ㅈ": "ㅉㅊ", "ㅉ": "ㅈㅊ", "ㅊ": "ㅈㅉ", "ㄹ": "ㄴ", "ㄴ": "ㄹ", "ㅁ": "ㅂ",
}
VOWEL_RIVALS = {"ㅓ": "ㅗ", "ㅗ": "ㅓㅜㅡ", "ㅜ": "ㅗㅡ", "ㅡ": "ㅜ", "ㅏ": "ㅓ"}


def split_syllable(ch: str):
    c = ord(ch) - 0xAC00
    if not 0 <= c < 11172:
        return None
    return c // 588, (c % 588) // 28, c % 28


def join_syllable(cho: int, jung: int, jong: int) -> str:
    return chr(0xAC00 + cho * 588 + jung * 28 + jong)


def rivals_of(word: str):
    """낱말에서 음절 하나의 첫소리나 모음 하나만 바꾼 짝들: [(음절 위치, 'onset'|'vowel', 원래, 바꾼 것, 짝 낱말)]"""
    out = []
    for i, ch in enumerate(word):
        p = split_syllable(ch)
        if not p:
            continue
        cho, jung, jong = p
        for r in ONSET_RIVALS.get(CHO[cho], ""):
            out.append((i, "onset", CHO[cho], r, word[:i] + join_syllable(CHO.index(r), jung, jong) + word[i + 1 :]))
        for r in VOWEL_RIVALS.get(JUNG[jung], ""):
            out.append((i, "vowel", JUNG[jung], r, word[:i] + join_syllable(cho, JUNG.index(r), jong) + word[i + 1 :]))
    return out


def _viterbi_frames(sc: RnntScorer, enc: np.ndarray, ys: list[int]) -> list[int]:
    """가장 그럴듯한 정렬에서 토큰마다 나온 프레임"""
    ctxs = sc._contexts([], ys)
    lp = sc._joint_logprobs(enc, sc._dec(ctxs))
    T, U = len(enc), len(ys)
    blank = lp[:, :, sc.blank]
    emit = np.stack([lp[:, u, ys[u]] for u in range(U)], axis=1)
    a = np.full((T, U + 1), -np.inf)
    back = np.zeros((T, U + 1), dtype=np.int8)  # 0: 빈칸으로 옴(t-1), 1: 토큰으로 옴(u-1)
    a[0, 0] = 0
    for u in range(1, U + 1):
        a[0, u] = a[0, u - 1] + emit[0, u - 1]
        back[0, u] = 1
    for t in range(1, T):
        a[t, 0] = a[t - 1, 0] + blank[t - 1, 0]
        for u in range(1, U + 1):
            x0, x1 = a[t - 1, u] + blank[t - 1, u], a[t, u - 1] + emit[t, u - 1]
            a[t, u], back[t, u] = (x1, 1) if x1 > x0 else (x0, 0)
    frames = [0] * U
    t, u = T - 1, U
    while u > 0:
        if back[t, u] == 1:
            frames[u - 1] = t
            u -= 1
        else:
            t -= 1
    return frames


# 짝 낱말 점수가 목표보다 이만큼(자연로그) 높으면 ‘짝 소리로 들림’. 바른 녹음에서 잘못 걸리지 않게 정한 값
MARGIN = 3.0
ILM = 0.2


def judge_words(x16k: np.ndarray, text: str, sc: RnntScorer | None = None, margin: float = MARGIN, ilm: float = ILM, enc: np.ndarray | None = None, gaps: dict | None = None):
    """문장의 낱말마다, 음절 하나를 바꾼 짝이 목표보다 확실히 더 그럴듯한지 본다.
    돌려주는 것: [{word, wordIndex, syl(낱말 안 음절), part, target, heardAs, gap}] — 걸린 것만"""
    sc = sc or get_scorer()
    if sc is None:
        return None
    words = [w for w in text.replace(".", " ").replace("?", " ").replace("!", " ").replace(",", " ").split() if w]
    if not words:
        return []
    enc = sc.encode(x16k) if enc is None else enc
    pieces = [sc.tokens(w) for w in words]
    ys = [t for p in pieces for t in p]
    if len(ys) > len(enc):
        return None
    frames = _viterbi_frames(sc, enc, ys)
    out = []
    k = 0
    for wi, (w, p) in enumerate(zip(words, pieces)):
        hist = ys[:k][-sc.ctx :]
        fr = frames[k : k + len(p)]
        prev_end = frames[k - 1] + 1 if k > 0 else 0
        nxt = frames[k + len(p)] if k + len(p) < len(frames) else len(enc) - 1
        t0, t1 = max(0, min(prev_end, fr[0] - 4)), min(len(enc), max(nxt, fr[-1] + 6))
        k += len(p)
        win = enc[t0:t1]
        base = sc.score(win, p, hist, ilm)
        best: dict[int, tuple] = {}
        for i, part, orig, rv, cand in rivals_of(w):
            g = sc.score(win, sc.tokens(cand), hist, ilm) - base
            if gaps is not None:
                gaps[(wi, i, part, rv)] = round(g, 2)  # 모든 짝의 점수 차 (음수 = 목표가 더 그럴듯)
            if g > margin and (i not in best or g > best[i][0]):
                best[i] = (g, part, orig, rv)
        for i, (g, part, orig, rv) in sorted(best.items()):
            out.append({"word": w, "wordIndex": wi, "syl": i, "part": part, "target": orig, "heardAs": rv, "gap": round(g, 2)})
    return out
