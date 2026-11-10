FROM python:3.13-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl bzip2 libsndfile1 ffmpeg tesseract-ocr tesseract-ocr-kor && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# 한국어 음성 인식 모델 (sherpa-onnx Zipformer, int8) — 빌드 때 한 번 받는다
RUN mkdir -p /models && curl -sSL https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-korean-2024-06-24.tar.bz2 \
    | tar xj -C /models && rm -f /models/sherpa-onnx-zipformer-korean-2024-06-24/*epoch-99-avg-1.onnx
ENV ASR_MODEL_DIR=/models/sherpa-onnx-zipformer-korean-2024-06-24
COPY malang_analyzer ./malang_analyzer
CMD ["python", "-m", "malang_analyzer.worker"]
