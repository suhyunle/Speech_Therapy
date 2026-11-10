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


## 무료 서버에 올리기 (Oracle Cloud Always Free)
음성 인식 워커가 메모리를 1GB 넘게 써서, 512MB짜리 무료 호스팅(Render·Koyeb 등)에는 전체가 들어가지 않는다.
Oracle Cloud Always Free의 ARM 서버(2 OCPU · 12GB, 2026년 6월부터 이 크기)는 DB·Redis·API·워커·웹을 한 대에 다 올릴 수 있다.

1. **계정 만들기**: cloud.oracle.com → Free Tier 가입 (카드 확인은 하지만 무료 범위 안에서는 청구 안 됨). 홈 리전은 바꿀 수 없으니 가까운 곳(서울·춘천)으로.
2. **서버 만들기**: Compute → Instances → Create
   - Image: Ubuntu 24.04 · Shape: `VM.Standard.A1.Flex` 2 OCPU / 12 GB
   - SSH 키 내려받기, 부트 볼륨 50GB 이상(무료 200GB까지)
   - "Out of capacity"가 뜨면 다른 가용 도메인(AD)을 고르거나 시간을 두고 다시 시도
3. **포트 열기**: 인스턴스 → Subnet → Security List → Ingress 규칙에 TCP 80, 443 (원본 0.0.0.0/0) 추가. 서버 안쪽 iptables는 setup.sh가 연다.
4. **주소(도메인)**: 마이크는 HTTPS에서만 켜져서 주소가 필요하다.
   - 무료: duckdns.org 에 로그인 → 하위 도메인 만들고 서버 공인 IP 입력 (예: `malang.duckdns.org`)
   - 아무것도 없으면 setup.sh가 `1-2-3-4.sslip.io` 같은 IP 주소를 쓴다 (인증서 발급 한도에 걸릴 수 있음)
5. **설치**: SSH 접속 후
   ```bash
   curl -fsSL https://raw.githubusercontent.com/suhyunle/Speech_Therapy/main/infrastructure/server/setup.sh | bash -s -- malang.duckdns.org
   ```
   Docker 설치 → 포트 열기 → 코드 받기 → 비밀값(.env) 자동 생성 → 빌드·실행. 처음 빌드는 음성 모델 받기와 ARM용 Praat 컴파일 때문에 10~20분.
   끝나면 관리자 비밀번호를 출력한다. **`.env`(특히 RECORDING_KEY)는 꼭 따로 백업** — 잃어버리면 저장된 녹음을 열 수 없다.
6. **업데이트**: 서버에서 `cd ~/Speech_Therapy && git pull && sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env up -d --build`

구성: Caddy(80·443, 인증서 자동) → `/api/*` 는 API, 나머지는 웹. DB·Redis·녹음은 Docker 볼륨에 남는다.
주의: Oracle은 무료 계정의 서버가 오래 거의 놀면(CPU 사용이 아주 낮으면) 회수할 수 있다고 안내한다. 실제 사용자가 생기면 유료 전환(Pay As You Go, 무료 범위는 그대로)을 고려.
