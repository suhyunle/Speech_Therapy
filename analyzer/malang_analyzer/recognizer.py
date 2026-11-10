"""음성 인식기 인터페이스.

지금 구현: sherpa-onnx Zipformer 한국어(언어모델 없음, greedy). 받아쓰기용으로 학습된 모델이라
실제 단어 쪽으로 기우는 경향이 있다. 음소 CTC 모델로 바꿀 때는 같은 recognize() 형태로 교체한다.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import numpy as np

SR = 16000


@dataclass
class Recognition:
    text: str
    tokens: list[str]
    timestamps: list[float]
    model: str


class Recognizer:
    name = "none"

    def recognize(self, audio: np.ndarray) -> Recognition | None:  # pragma: no cover
        raise NotImplementedError


class SherpaRecognizer(Recognizer):
    def __init__(self, model_dir: str, threads: int = 2):
        import sherpa_onnx

        d = model_dir.rstrip("/") + "/"
        self.name = "sherpa-onnx-zipformer-korean-2024-06-24-int8"
        self._r = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=d + "encoder-epoch-99-avg-1.int8.onnx",
            decoder=d + "decoder-epoch-99-avg-1.int8.onnx",
            joiner=d + "joiner-epoch-99-avg-1.int8.onnx",
            tokens=d + "tokens.txt",
            num_threads=threads,
            decoding_method="greedy_search",
        )

    def recognize(self, audio: np.ndarray) -> Recognition:
        s = self._r.create_stream()
        # 앞뒤 무음을 조금 붙여야 짧은 단어가 잘리지 않는다
        pad = np.zeros(int(0.3 * SR), dtype=np.float32)
        s.accept_waveform(SR, np.concatenate([pad, audio.astype(np.float32), pad]))
        self._r.decode_stream(s)
        res = s.result
        # 토큰 앞 공백이 단어 경계 → 띄어쓰기를 살려 그대로 보여준다(보정 없음)
        text = "".join(res.tokens).replace("▁", " ").strip()
        ts = [max(0.0, t - 0.3) for t in list(res.timestamps)]
        return Recognition(text=text, tokens=list(res.tokens), timestamps=ts, model=self.name)


_instance: Recognizer | None = None


def get_recognizer() -> Recognizer | None:
    global _instance
    if _instance is not None:
        return _instance
    model_dir = os.environ.get("ASR_MODEL_DIR", "")
    if model_dir and os.path.exists(os.path.join(model_dir, "tokens.txt")):
        _instance = SherpaRecognizer(model_dir, int(os.environ.get("ASR_THREADS", "2")))
    return _instance
