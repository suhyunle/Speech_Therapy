# 백엔드 구조

## API 서버 (`backend/`, NestJS 10 · Prisma 7 + pg 어댑터)

```
backend/
├── prisma/
│   ├── schema.prisma            데이터 모델 (ERD 원본)
│   ├── migrations/              마이그레이션 SQL
│   └── seed.ts                  소리 40개 · 문항 195개 · 관리자 계정
├── prisma.config.ts             Prisma 7 설정 (DB 주소, 마이그레이션 경로, 시드)
├── src/
│   ├── main.ts                  부트스트랩 · 전역 Validation · CORS · Swagger(/api/docs)
│   ├── app.module.ts            모듈 조립 · 전역 가드(Throttler → JWT → Roles) · 오류 필터 · 보관 기간 정리 작업
│   ├── common/
│   │   ├── auth.ts              JwtAuthGuard · RolesGuard · @Public · @Roles · @CurrentUser
│   │   ├── prisma.service.ts    Prisma 클라이언트 (pg 어댑터)
│   │   ├── redis.service.ts     분석 대기열 LPUSH · 결과 알림 구독
│   │   ├── storage.service.ts   녹음 AES-256-GCM 암호화 저장 · 복호화 · 삭제
│   │   ├── hangul.ts            발음 안의 소리 찾기 (오늘의 학습 문항 고르기)
│   │   └── util.ts              서울 기준 날짜 · 오류 응답 통일
│   └── modules/
│       ├── auth/                가입 · 로그인 잠금 · 토큰 회전 · 게스트 · 카카오/구글 OAuth(로그인·계정 연결) · 비밀번호 바꾸기
│       ├── users/               설정 · 동의 · 보관 기간 · 내 목소리에 맞추기 · 기록 내보내기 zip · 연결된 로그인 · 내 녹음 지우기 · 계정 삭제
│       ├── content/             소리 · 문항 조회 · 연습 순서 묶음
│       ├── placement/           첫 진단 시작 · 판정(decide) · PCC/PWC(wordMetrics)
│       ├── plan/                오늘의 학습 (목표별 구성, 날마다 돌리기)
│       ├── attempts/            녹음 업로드 · WAV 확인 · 분석 대기열 · SSE · 재생 · 신고
│       ├── progress/            결과 반영(한 번만) · 오늘 기록 · 연속 기록 · 소리 진도 · 성장 기록
│       ├── diary/               한 줄 일기
│       ├── listen/              받아쓰기 링크 · 공개 듣기 · 답 · 정답 공개 · 사람 귀 vs 앱(agreement · byListener)
│       ├── training/            복습 3개 · 기초선(3단어×3번) · 일주일 체크 · 발성 연습 문항과 최근 결과
│       ├── scripts/             내 글로 연습: 원고 올리기(pptx·pdf·사진·글) · 슬라이드 · 읽은 녹음 → 원고 맞춤 분석
│       ├── notify/              웹 푸시(VAPID) 구독 · 매분 알림 시간 확인 후 발송 · 시험 알림 · 출시 소식 신청
│       ├── admin/               문항 CRUD · 검토 승인 · 신고 · 통계
│       └── domain.spec.ts       도메인 규칙 단위 테스트
└── test/app.e2e-spec.ts         API 통합 테스트 (실제 PostgreSQL · Redis)
```

요구사항 문서의 예상 모듈과의 대응: AuthModule → `auth`, UserModule → `users`, ContentModule → `content`(+`admin`),
TherapyModule/LearningModule → `placement` · `plan` · `attempts`, ProgressModule → `progress`, AudioModule → `attempts`(녹음) + `common/storage`,
AdminModule → `admin`. ChildModule · TherapistModule은 디자인에 해당 역할·화면이 없어 만들지 않았다(사용자 승인, requirements.md 2장).

### 주요 규칙
| 규칙 | 위치 |
|---|---|
| 로그인 5번 틀리면 10분 잠금, 틀린 쪽을 밝히지 않음 | `auth.service.ts` |
| 리프레시 토큰 재사용 → 같은 묶음 전체 폐기 | `auth.service.ts refresh()` |
| 첫 녹음 전 목소리 녹음 동의 필수 | `attempts.module.ts create()` |
| 진단: 나온 단계 2개 이상에서 모두 통과 → 이미 좋음 | `placement.module.ts decide()` |
| 소리 '배웠어요': 서로 다른 문항 3개 이상에서 통과 4번 | `progress.service.ts` |
| 분석 결과는 시도마다 한 번만 반영 (`appliedAt`) | `progress.service.ts apply()` |
| 정답을 바꾸면 검토 상태 초기화 | `admin.module.ts update()` |
| 보관 기간 지난 녹음 원본 삭제 (1시간마다) | `app.module.ts RetentionJob` |

## 분석 워커 (`analyzer/`, Python 3.13)

```
analyzer/malang_analyzer/
├── worker.py       대기열(BRPOP) → DB 읽기 → 복호화 → 분석 → 결과 저장 → PUBLISH
├── pipeline.py     ① 녹음 검사 ② 인식 ③ 정답 소리 ④ 정렬 ⑤ 측정 ⑥ 피드백
├── audio.py        녹음 문제 5가지 · Praat 피치/음량/포먼트 · 쉬익 미터 · 끝소리
├── recognizer.py   음성 인식기 인터페이스 (지금: sherpa-onnx Zipformer 한국어)
├── pronounce.py    표준발음법 규칙 엔진 · 소리(음소) 나누기
├── align.py        편집거리 정렬 · 허용 발음 · 소리별 판정
└── feedback.py     응원·고칠 것 문구 규칙 (디자인 '응원 규칙' 메모)
tests/              pronounce 22 · align 5 · audio 5 · 실제 음성 인식 1 + 추가
```

### 인식기 교체
`recognizer.py`의 `Recognizer.recognize(audio) -> Recognition(text, tokens, timestamps, model)` 형태만 맞추면 된다.
디자인 기술 설계의 목표인 한국어 **음소 CTC 모델 + GOP-SF**로 바꾸면 `unsure`(확실하지 않음)를 음소 확신도로 정할 수 있다.
