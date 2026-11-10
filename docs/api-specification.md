# API 명세

- 기준 주소: `http://localhost:4000/api` · Swagger UI: `/api/docs` · OpenAPI JSON: [`openapi.json`](openapi.json) (실행 중인 서버에서 생성)
- 인증: `Authorization: Bearer <accessToken>` (15분). 만료되면 `POST /auth/refresh`. SSE는 `?access_token=`.
- 오류 형식: `{ "statusCode": 401, "message": "아이디 또는 비밀번호가 맞지 않아요", "code": "BAD_CREDENTIALS" }`
- 엔드포인트 75개

| 메서드 | 경로 | 권한 | 하는 일 |
|---|---|---|---|
| `GET` | `/api/auth/check-id` | 공개 | 아이디 쓸 수 있는지 (형식·중복) |
| `POST` | `/api/auth/signup` | 공개 | 아이디 가입 (게스트 토큰이 있으면 기록 이어받기, 14세 미만 보호자 동의) |
| `POST` | `/api/auth/login` | 공개 | 아이디 로그인 (틀리면 같은 문구, 5회 → 10분 잠금) |
| `POST` | `/api/auth/guest` | 공개 | 로그인 없이 진단 (게스트 계정) |
| `POST` | `/api/auth/refresh` | 공개 | 토큰 갱신 (회전 · 재사용 감지) |
| `POST` | `/api/auth/logout` | 공개 | 로그아웃 |
| `POST` | `/api/auth/password` | 로그인 | 비밀번호 바꾸기 (지금 비밀번호 확인, 간편 로그인 직후엔 생략) · 간편 로그인 계정은 아이디도 함께 만들기 · 다른 기기 로그인 끊김 |
| `POST` | `/api/auth/email` | 로그인 | 이메일 등록·바꾸기 → 인증 메일 (24시간 링크) |
| `POST` | `/api/auth/email/verify` | 공개 | 메일 링크의 토큰으로 이메일 인증 |
| `POST` | `/api/auth/password/forgot` | 공개 | 아이디 또는 인증한 이메일 → 재설정 링크(30분, 한 번). 계정이 있는지는 알려주지 않음 |
| `POST` | `/api/auth/password/reset` | 공개 | 토큰 + 새 비밀번호 → 바꾸고 다른 기기 로그아웃 |
| `GET` | `/api/auth/me` | 로그인 | 내 정보 |
| `GET` | `/api/auth/providers` | 공개 | 카카오·구글 사용 가능 여부 |
| `GET` | `/api/auth/oauth/{provider}/url` | 공개 | OAuth 로그인 주소 |
| `POST` | `/api/auth/oauth/{provider}/callback` | 공개 | OAuth 코드 교환 → 로그인 |
| `GET` | `/api/me/settings` | 로그인 | 하루 목표 · 알림 · 진동 · 글자 크기 · 보관 기간 |
| `PATCH` | `/api/me/settings` | 로그인 | 하루 목표 · 알림 · 진동 · 글자 크기 · 보관 기간 |
| `GET` | `/api/me/consents` | 로그인 | 동의 기록 (녹음 · 모델 개선 · 연구) |
| `POST` | `/api/me/consents` | 로그인 | 동의 기록 (녹음 · 모델 개선 · 연구) |
| `DELETE` | `/api/me/recordings` | 로그인 | 내 녹음 원본 전부 지우기 |
| `GET` | `/api/me/voice-model` | 로그인 | 내 목소리에 맞추기 상태 (모은 녹음 수 / 300, 개인 기준값) |
| `POST` | `/api/me/voice-model` | 로그인 | 내 목소리에 맞추기 켜기(동의 기록)·끄기(기준값 삭제) |
| `GET` | `/api/me/export` | 로그인 | 기록 내보내기 zip (CSV: 녹음·듣는 사람·일기·동의, `?audio=1` 원본 포함) |
| `GET` | `/api/me/identities` | 로그인 | 연결된 로그인 방법 (아이디 · 카카오 · 구글) |
| `DELETE` | `/api/me` | 로그인 | 계정 삭제 |
| `GET` | `/api/sounds` | 로그인 | 소리 40개 |
| `GET` | `/api/sounds/{symbol}` | 로그인 | 소리 레슨 + 문항 |
| `GET` | `/api/items/{id}` | 로그인 | 문항 하나 |
| `POST` | `/api/placement` | 로그인 | 첫 진단 시작 (글자 23 · 단어 8 · 문장 3) |
| `GET` | `/api/placement/latest` | 로그인 | 마지막 진단 결과 |
| `GET` | `/api/placement/{id}` | 로그인 | 진단 진행 상황 |
| `POST` | `/api/placement/{id}/finish` | 로그인 | 진단 판정 → 이미 좋은 소리 클리어 · PCC/PWC |
| `GET` | `/api/progress` | 로그인 | 성장 기록 (주간 녹음, 처음 vs 지금, PCC) |
| `GET` | `/api/plan/today` | 로그인 | 오늘의 학습 (현재 소리 · 문항 · 경로 · 연속 기록) |
| `POST` | `/api/attempts` | 로그인 | 녹음 업로드(WAV) → 분석 대기열 / 내 녹음 목록 |
| `GET` | `/api/attempts` | 로그인 | 녹음 업로드(WAV) → 분석 대기열 / 내 녹음 목록 |
| `GET` | `/api/attempts/{id}` | 로그인 | 분석 결과 |
| `GET` | `/api/attempts/{id}/events` | 로그인 | 분석 진행 실시간 (SSE, ?access_token=) |
| `GET` | `/api/attempts/{id}/audio` | 로그인 | 내 녹음 재생 (복호화) |
| `POST` | `/api/attempts/{id}/report` | 로그인 | 결과가 이상해요 |
| `GET` | `/api/diary/today` | 로그인 | 한 줄 일기 |
| `PUT` | `/api/diary/today` | 로그인 | 한 줄 일기 |
| `POST` | `/api/listen-links` | 로그인 | 받아쓰기 링크 만들기 / 내 링크와 사람 귀 vs 앱 |
| `GET` | `/api/listen-links` | 로그인 | 받아쓰기 링크 만들기 / 내 링크와 사람 귀 vs 앱 |
| `DELETE` | `/api/listen-links/{id}` | 로그인 | 링크 취소 |
| `GET` | `/api/l/{code}` | 공개 | (공개) 듣는 사람 화면 정보 — 정답 없음 |
| `GET` | `/api/l/{code}/items/{order}/audio` | 공개 | (공개) 녹음 듣기 |
| `POST` | `/api/l/{code}/answers` | 공개 | (공개) 받아쓰기 제출 |
| `GET` | `/api/l/{code}/reveal` | 공개 | (공개) 다 답한 뒤 정답 보기 |
| `GET` | `/api/admin/stats` | 관리자 | (관리자) 숫자 통계 |
| `GET` | `/api/admin/items` | 관리자 | (관리자) 문항 목록 · 등록 |
| `POST` | `/api/admin/items` | 관리자 | (관리자) 문항 목록 · 등록 |
| `PATCH` | `/api/admin/items/{id}` | 관리자 | (관리자) 문항 수정 · 삭제 |
| `DELETE` | `/api/admin/items/{id}` | 관리자 | (관리자) 문항 수정 · 삭제 |
| `POST` | `/api/admin/items/{id}/review` | 관리자 | (관리자) 검토 승인 |
| `GET` | `/api/admin/reports` | 관리자 | (관리자) 신고 목록 |
| `POST` | `/api/admin/reports/{id}/resolve` | 관리자 | (관리자) 신고 확인 |
| `GET` | `/api/review` | 로그인 | 복습 3개 (배웠거나 이미 좋은 소리 중 오래 안 본 것) |
| `GET` | `/api/baseline/{symbol}` | 로그인 | 새 소리 기초선: 단어 3개 × 3번 진행 상황 |
| `GET` | `/api/weekly` | 로그인 | 일주일 체크할 소리 목록 |
| `GET` | `/api/weekly/{symbol}` | 로그인 | 일주일 체크: 기초선 vs 지금 (같은 단어, 들린 대로) |
| `GET` | `/api/exercises` | 로그인 | 발성 연습 문항 (앞으로 · 끝소리 · 억양 · 길이 · 쉬익) + 최근 2번 결과 |
| `POST` | `/api/scripts` | 로그인 | 내 글로 연습: 원고 올리기 (pptx · pdf · 사진 OCR 또는 `text`) |
| `GET` | `/api/scripts` | 로그인 | 내 원고 목록 |
| `GET` | `/api/scripts/{id}` | 로그인 | 원고 (슬라이드별 글 + 지난 연습 10개) |
| `DELETE` | `/api/scripts/{id}` | 로그인 | 원고와 연습 녹음 지우기 |
| `GET` | `/api/scripts/{id}/events` | 로그인 | 글 뽑기 진행 (SSE) |
| `POST` | `/api/scripts/{id}/runs` | 로그인 | 읽은 녹음 올리기 (슬라이드 범위, 내 말로 풀어 말하기) → 분석 대기열 |
| `GET` | `/api/script-runs/{id}` | 로그인 | 원고 맞춤 결과 (문장·단어별 달라진 발음 · 건너뜀 · 끝소리 · 빠르기) |
| `GET` | `/api/script-runs/{id}/events` | 로그인 | 분석 진행 (SSE) |
| `GET` | `/api/push/key` | 로그인 | 웹 푸시 공개키 (VAPID) |
| `POST` | `/api/push/subscribe` | 로그인 | 이 기기 알림 구독 등록 |
| `DELETE` | `/api/push/subscribe` | 로그인 | 알림 구독 해제 |
| `POST` | `/api/push/test` | 로그인 | 시험 알림 보내기 |
| `POST` | `/api/newsletter` | 공개 | 출시 소식 신청 (랜딩 페이지) |

## 녹음 업로드 `POST /attempts` (multipart/form-data)
| 필드 | 값 |
|---|---|
| `audio` | 16kHz 모노 PCM WAV (최대 10MB) |
| `context` | `MIC_CHECK` · `PLACEMENT` · `PRACTICE` · `BASELINE` · `WEEKLY` · `REVIEW` · `EXERCISE` |
| `itemId` | 문항 ID (`text` 를 주면 생략 가능) |
| `text` | 직접 정한 글자 (내 글로 연습에서 달라진 단어 연습) |
| `clientId` | 기기에서 만든 ID · 인터넷이 끊겼다 다시 올릴 때 같은 녹음을 두 번 받지 않음 |
| `placementSessionId` | 진단 중일 때 |
| `soundSymbol` | 연습 중인 소리 (진도 반영) |
| `durationMs` | 녹음 길이 |

목소리 녹음 동의(`VOICE_RECORDING`)가 없으면 `403 VOICE_CONSENT_REQUIRED`.

## 분석 결과 `Attempt.result` (워커가 씀)
```json
{
  "target": "다리", "targetPronunciation": "다리",
  "quality": { "ok": true, "issue": null, "speechDb": -24.1, "noiseDb": -61.0, "snrDb": 36.9, "speechSec": 0.33 },
  "heard": "다리도", "heardPronunciation": "다리도",
  "phonemes": { "ops": [ { "target": { "symbol": "ㄷ", "pos": "onset", "syl": 0 }, "got": { "symbol": "ㄷ", "pos": "onset", "syl": 0 }, "type": "same" } ],
                "matched": 4, "total": 4, "inserted": 2, "diffRatio": 0.0 },
  "soundVerdicts": { "ㄷ": true },
  "measures": { "intensityDb": 68.2, "pitchHz": 212.3, "hiss": null, "formants": null, "rateSylPerSec": null, "endDrop": null },
  "voice": { "loudness": "ok", "pitch": "high", "rate": null, "reason": null },
  "feedback": { "headline": "4소리 모두 났어요 · 뒤에 소리가 조금 더 붙었어요", "cheer": "한 번 더 해냈어요!", "tip": "정답 단어까지만 말하고 멈춰요", "next": "continue" },
  "passed": true, "model": "sherpa-onnx-zipformer-korean-2024-06-24-int8", "limits": ["word_level_asr"]
}
```
`type`: `same` 같음 · `allowed` 허용 발음 · `sub` 바뀜 · `del` 빠짐 · `ins` 더해짐 · `unsure` 확실하지 않음.
`quality.issue`: `too_quiet` · `noisy` · `too_short` · `clipped` · `mismatch` → 상태 `ISSUE`, 횟수에 안 셈.

발성 연습(`EXERCISE`)·모음이 들어간 녹음은 `result.exercise`(글자별 크기·길이, 끝 높이 변화, 울림 위치)와 `result.vowelPoint`(F1·F2, 가장 가까운 모음, 목표 칸)가 더 붙어요. 소리 모양 막대는 `result.measures.shape`.

## 오늘의 학습 `GET /plan/today` 추가 필드
`warmup`(발성 1분 문항·했는지) · `baselineNeeded`(지금 소리 기초선 필요) · `weeklyDue`(일주일 체크할 소리) · `daysAway`(마지막 연습 뒤 쉰 날) · `learnedCount` · `vowelSet`(`f`|`m`, 모음 지도 기준 평균).

## 소리 교차 확인 `result.acousticChecks`
받아쓰기가 ㅅ·ㅆ을 맞게 들었어도 녹음의 바람 소리가 거의 없으면(`no_hiss`) 또는 중심이 4kHz보다 낮으면(`low_hiss`, ㅣ·ㅑ 등 앞은 제외) 해당 `ops[].type`을 `unsure`로 바꾸고 `ops[].reason`에 이유를 남긴다.
`{ "symbol": "ㅅ", "syl": 0, "reason": "no_hiss", "hissSec": 0.0, "centroidKHz": null }`
`GET /plan/today` 에 `vowelTargets`(내 목소리에 맞춘 모음 목표, 없으면 null). `GET /auth/providers` 에 `email`(메일 발송 가능). `GET /me/identities` 에 `email`·`emailVerified`.
