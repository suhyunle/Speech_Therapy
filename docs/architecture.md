# 시스템 아키텍처

```
 브라우저 (Next.js 14 · React · Tailwind · React Query · Zustand)
   │  녹음: getUserMedia → AudioWorklet → 16kHz 모노 WAV
   │  실시간(기기): 크기 막대 · 쉬익 미터 (AnalyserNode FFT)
   │
   │ REST + JWT (Authorization: Bearer)        SSE(분석 진행)
   ▼
 API 서버 (NestJS 10 · Prisma 5)  ── Swagger /api/docs
   │  Auth · Users · Consents · Content · Placement · Plan · Attempts
   │  Progress · Diary · Listen · Reports · Admin
   │
   ├──▶ PostgreSQL 16  (사용자·시도·결과·동의·콘텐츠)
   ├──▶ 녹음 저장소 (파일 볼륨, AES-256-GCM 암호화)   ※ 운영 시 S3 호환으로 교체 가능한 StorageService
   └──▶ Redis  ─ LPUSH malang:jobs ──▶ 분석 워커 (Python 3.13)
                ◀─ PUBLISH malang:attempt:{id} ─┘    ① 녹음 검사  ② 음성 인식(sherpa-onnx)
                                                     ③ 정답 음소(표준발음법 규칙)  ④ 정렬 비교
                                                     ⑤ 측정(Praat: 음량·피치·포먼트·쉬익)  ⑥ 피드백 규칙
```

## 원칙 (디자인 DevStructure 보드)
- **말하는 동안 보이는 건 기기에서, 기록에 남는 판단은 서버에서.** 기기 계산은 표시용, DB에 남는 값은 워커 계산값만.
- **분석 결과를 만들지 않는다.** 워커가 계산할 수 없는 항목은 `null`과 이유를 저장하고 화면은 "확인 못 함"으로 표시.
- **도메인별 모듈.** 각 Nest 모듈은 controller / service / dto / 테스트로 나뉜다.

## 처리 순서 (녹음 하나)
1. 브라우저가 녹음 중 크기·쉬익 미터를 그린다.
2. 녹음이 끝나면 브라우저가 먼저 너무 작음·짧음을 검사한다(바로 다시).
3. `POST /attempts` (multipart WAV) → API가 암호화 저장, Attempt `QUEUED` 생성, Redis 대기열에 넣음.
4. 워커가 `BRPOP`으로 받아 6단계 분석 → Attempt에 결과 JSON 저장, 상태 `DONE`/`ISSUE`/`FAILED` → `PUBLISH`.
5. 브라우저는 `GET /attempts/:id/events`(SSE)로 진행을 받고, 끊기면 `GET /attempts/:id` 폴링.
6. API가 DONE 이벤트를 받으면 오늘 진행·연속 기록·소리 진도를 갱신(ProgressService).

## 보안
- 비밀번호 Argon2id, 로그인 5회 실패 10분 잠금, 로그인 요청 속도 제한(Throttler).
- 리프레시 토큰은 SHA-256 해시만 DB에 저장, 사용할 때마다 회전, 재사용 감지 시 전체 폐기.
- 모든 학습 데이터 조회는 `userId = 토큰 주인` 조건으로만. 관리자 API는 `RolesGuard(ADMIN)`.
- 녹음 원본: 파일마다 랜덤 IV, 키는 `RECORDING_KEY` 환경변수(32바이트). 워커도 같은 키로 복호화.
- 듣는 사람 링크: 추측 불가 코드(base64url 12바이트), 7일 만료, 취소 가능, 학습자 이름 비공개.
- 보관 기간이 지난 녹음은 API의 정리 작업(1시간마다)이 파일을 지우고 `deletedAt` 기록.

## 기술 선택이 지시서와 다른 곳
| 항목 | 선택 | 이유 | 단점 |
|---|---|---|---|
| 분석 | Python 워커 별도 | 음성 라이브러리(Praat, ONNX 인식기)가 Python | 서비스 1개 추가, 공유 스키마 관리 |
| 대기열 | Redis 리스트(LPUSH/BRPOP) | Node·Python 양쪽에서 단순, BullMQ는 Python 소비가 어려움 | 재시도는 직접 구현(워커 재시작 시 PROCESSING 상태 재큐) |
| 저장소 | 로컬 볼륨 + 암호화 | 개발·단일 서버에서 바로 동작 | 다중 서버 시 S3 호환으로 교체 필요 |
| 정답 음소 | 자체 표준발음법 엔진 | g2pk는 MeCab 의존성 설치가 막힘 | 형태소 정보가 필요한 예외(된소리 일부)는 관리자가 고정본으로 입력 |
