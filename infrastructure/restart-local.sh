#!/usr/bin/env bash
# 이 작업 공간용: API · 워커 · 웹 다시 띄우기 (DB·Redis가 떠 있어야 함)
ROOT=$(cd "$(dirname "$0")/.." && pwd); L=${LOG_DIR:-/tmp/malang-logs}; mkdir -p $L
pkill -f "node dist/main.js"; pkill -f malang_analyzer.worker; pkill -f next-server; pkill -f "standalone/server.js"; sleep 1
cd $ROOT/backend && (nohup node dist/main.js > $L/api.log 2>&1 &)
cd $ROOT/analyzer && set -a && . ../backend/.env && set +a && (ASR_MODEL_DIR=$ROOT/models/sherpa-onnx-zipformer-korean-2024-06-24 nohup .venv/bin/python -m malang_analyzer.worker > $L/worker.log 2>&1 &)
cd $ROOT/frontend && cp -r .next/static .next/standalone/.next/ 2>/dev/null; cp -r public .next/standalone/ 2>/dev/null; (PORT=3000 nohup node .next/standalone/server.js > $L/web.log 2>&1 &)
sleep 4; curl -s -o /dev/null -w "api %{http_code} " localhost:4000/api/auth/providers; curl -s -o /dev/null -w "web %{http_code}\n" localhost:3000/
