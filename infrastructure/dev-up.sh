#!/usr/bin/env bash
# Docker 없이 로컬에서 띄우기 (PostgreSQL 16 · Redis · Node 22 · Python 3.13 필요)
# 사용: ./infrastructure/dev-up.sh   (처음 한 번: backend/.env, frontend/.env.local 준비)
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
LOG=${LOG_DIR:-$ROOT/.logs}; mkdir -p "$LOG" "$ROOT/storage"

# 1) DB 마이그레이션 · 시드
cd "$ROOT/backend"
set -a; . ./.env; set +a
if npx prisma migrate deploy >/dev/null 2>&1; then echo "migrate: prisma"; else
  # 스키마 엔진을 받을 수 없는 환경: 마이그레이션 SQL을 순서대로 직접 적용 (적용한 것은 _malang_migrations 에 기록)
  DB="${DATABASE_URL%%\?*}"
  psql "$DB" -q -c 'CREATE TABLE IF NOT EXISTS "_malang_migrations" (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())'
  for dir in prisma/migrations/*/; do
    name=$(basename "$dir")
    [ -f "$dir/migration.sql" ] || continue
    if [ "$(psql "$DB" -tAc "SELECT 1 FROM \"_malang_migrations\" WHERE name='$name'")" = "1" ]; then continue; fi
    # 예전에 수동으로 init 만 적용한 DB: 표가 이미 있으면 기록만 남긴다
    if [ "$name" = "20261110000000_init" ] && [ "$(psql "$DB" -tAc "SELECT to_regclass('public.\"User\"') IS NOT NULL")" = "t" ]; then
      psql "$DB" -q -c "INSERT INTO \"_malang_migrations\"(name) VALUES ('$name')"; continue
    fi
    psql "$DB" -v ON_ERROR_STOP=1 -q -f "$dir/migration.sql" && psql "$DB" -q -c "INSERT INTO \"_malang_migrations\"(name) VALUES ('$name')" && echo "migrate: $name"
  done
fi
npx ts-node prisma/seed.ts
npx nest build >/dev/null
nohup node dist/main.js >"$LOG/api.log" 2>&1 &

# 2) 분석 워커
cd "$ROOT/analyzer"
[ -d .venv ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt; }
MODEL="$ROOT/models/sherpa-onnx-zipformer-korean-2024-06-24"
if [ ! -f "$MODEL/tokens.txt" ]; then
  mkdir -p "$ROOT/models"
  curl -sSL https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-korean-2024-06-24.tar.bz2 | tar xj -C "$ROOT/models"
fi
ASR_MODEL_DIR="$MODEL" nohup .venv/bin/python -m malang_analyzer.worker >"$LOG/worker.log" 2>&1 &

# 3) 웹
cd "$ROOT/frontend"
npm run build >/dev/null
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true
nohup node .next/standalone/server.js >"$LOG/web.log" 2>&1 &
echo "웹 http://localhost:3000 · API http://localhost:4000/api · Swagger http://localhost:4000/api/docs · 로그 $LOG"
