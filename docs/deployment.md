# 배포

## Docker Compose (권장)
```bash
cp .env.example .env          # POSTGRES_PASSWORD · JWT_SECRET · RECORDING_KEY · ADMIN_PASSWORD 채우기
openssl rand -hex 32          # JWT_SECRET
openssl rand -base64 32       # RECORDING_KEY (잃어버리면 저장된 녹음을 열 수 없음 → 따로 보관)
docker compose --env-file .env up --build
```
| 서비스 | 내용 | 포트 |
|---|---|---|
| db | PostgreSQL 16 | 내부 |
| redis | 분석 대기열 · 알림 | 내부 |
| api | NestJS — 시작할 때 `prisma migrate deploy` → 시드 → 서버 | 4000 |
| worker | Python 분석 워커 (빌드 때 한국어 인식 모델 내려받음, 약 75MB) | — |
| web | Next.js standalone | 3000 |

녹음 파일은 `recordings` 볼륨을 api(읽기/쓰기)와 worker(읽기 전용)가 같이 쓴다.
워커를 늘릴 때는 `docker compose up --scale worker=3` (대기열은 Redis 리스트라 여러 워커가 나눠 가져감).

※ 이 작업 공간에는 Docker 데몬이 없어 `docker compose up`을 실제로 돌려보지 못했다. 같은 구성(PostgreSQL 16 · Redis · Node 22 · Python 3.13)을 직접 띄워 통합 테스트를 통과시켰다.

## Docker 없이
`./infrastructure/dev-up.sh` — `backend/.env`, `frontend/.env.local` 준비 후 실행. Prisma 스키마 엔진을 받을 수 없으면 `prisma/migrations/*`를 순서대로 psql로 적용하고 `_malang_migrations` 표에 기록한다(다시 실행해도 안전).

## 운영 체크리스트
- HTTPS 앞단(예: Nginx·클라우드 LB)에서 TLS 종료. 마이크는 HTTPS(또는 localhost)에서만 동작한다.
- `WEB_ORIGIN`을 실제 웹 주소로 (CORS).
- 카카오·구글: 각 개발자 콘솔에 Redirect URI `https://<웹>/auth/callback/kakao`, `/google` 등록 후 키 입력.
- 녹음 저장소를 여러 서버가 써야 하면 `StorageService`(put/get/remove)를 S3 호환으로 교체.
- 백업: DB 덤프 + `recordings` 볼륨 + `RECORDING_KEY`.
- 보관 기간: 사용자 설정(기본 90일). 정책 확정 필요 (디자인 TechSpec: "[보관 기간 정책 입력]").
- iOS 앱 출시 시 Apple 로그인 필요 (디자인 메모).
- 웹 푸시: `npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT(mailto:…)`. 비우면 알림 버튼이 ‘서버 설정 전’으로 보인다. 서비스 워커는 HTTPS에서만 등록된다.
- 이메일: `SMTP_URL`(예: `smtps://아이디:비밀번호@smtp.example.com:465`) · `MAIL_FROM`. 비우면 이메일 인증·재설정이 ‘서버 설정 전’으로 보이고 간편 로그인 경로만 남는다. 메일 링크 주소는 `WEB_ORIGIN` 첫 값.
- 오프라인: `npm run build`가 `public/precache.json`(화면·JS·CSS 목록)을 만든다. `next build`만 돌리면 미리 받기 없이 쓸 때만 저장된다.
- 내 글로 연습: 워커 이미지에 `ffmpeg`(mp3·m4a 변환) · `tesseract-ocr-kor`(사진 OCR)가 들어 있어야 한다 (analyzer/Dockerfile).

## 마이그레이션
- 평소: `cd backend && npx prisma migrate dev --name <이름>`
- 스키마 엔진 바이너리를 받을 수 없는 환경: `python3 database/gen_migration.py backend/prisma/schema.prisma` 로 SQL 생성 (Prisma 명명 규칙 그대로).
