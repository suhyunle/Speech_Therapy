FROM python:3.13-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl bzip2 libsndfile1 ffmpeg tesseract-ocr tesseract-ocr-kor && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
# ARM(예: Oracle 무료 서버)에는 praat-parselmouth 완성본(wheel)이 없어서 소스로 빌드한다 → 컴파일 도구를 잠깐 깔았다 지움 (처음 빌드 10~20분)
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake git \
    && pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y build-essential cmake git && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
# 한국어 음성 인식 모델 (sherpa-onnx Zipformer, int8) — 빌드 때 한 번 받는다
RUN mkdir -p /models && curl -sSL https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-korean-2024-06-24.tar.bz2 \
    | tar xj -C /models && rm -f /models/sherpa-onnx-zipformer-korean-2024-06-24/*epoch-99-avg-1.onnx
ENV ASR_MODEL_DIR=/models/sherpa-onnx-zipformer-korean-2024-06-24
COPY malang_analyzer ./malang_analyzer
CMD ["python", "-m", "malang_analyzer.worker"]
