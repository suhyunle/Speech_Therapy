# 프론트엔드 구조 (`frontend/`, Next.js 14 App Router · React 18 · Tailwind · React Query · Zustand)

```
frontend/src/
├── app/                         화면 (디자인 보드 이름)
│   ├── page.tsx                 /  로그인 상태면 홈, 설치 앱이면 /welcome, 아니면 Landing(마케팅)
│   ├── welcome/ · tutorial/     Splash · Welcome · TutPain~TutPromise(6단계, WebTutorial)
│   ├── privacy/ · terms/        개인정보 처리방침 · 이용약관
│   ├── login/ · login/id/       Login · WebLogin · IdLogin
│   ├── signup/ · forgot/        SignUp(보호자 동의) · 비밀번호 다시 만들기(간편 로그인 경유)
│   ├── auth/callback/[p]/       OAuth 돌아오는 곳 (연결 · 비밀번호 찾기 후 이동)
│   ├── start/ · start/goal/     MicPermission · MicDenied · WebMicError(QR) · MicCheck · WebOnboarding · GoalSetup
│   ├── placement/ (+result/)    PlacementIntro~Sentence · WebPlacement · PlacementResult · WebPlacementResult
│   ├── order/                   LearnOrder (+ 넓은 화면 하루 목표)
│   ├── home/                    Main · WebHome(대시보드)
│   ├── welcome-back/            StreakLost
│   ├── review/                  Review (복습 3개)
│   ├── baseline/[symbol]/       Baseline (3단어 × 3번, 피드백 없음)
│   ├── weekly/[symbol]/         WeeklyCheck
│   ├── learn/[symbol]/          Learn · LearnB · LearnVowel · WebLearn(실시간 쉬익 미터·진동)
│   ├── practice/[itemId]/       Record · RecordSentence · RecordVowel · WebPractice · ExitConfirm (`custom?text=` 직접 정한 단어)
│   ├── result/[id]/             Result · WebResult · Uncertain · HelpSheet
│   ├── complete/                Complete · WebComplete · Diary
│   ├── voice/ · voice/[kind]/   WebVoice · VoiceForward · EndClear · Intonation · Timing
│   ├── smeter/                  SMeter
│   ├── soundmap/ (+vowels/ textures/)  SoundMap · WebSoundMap · Vowels · SoundTextures
│   ├── progress/ (+vowels/)     Progress · WebRecords · VowelSpace
│   ├── records/                 Records · EmptyRecords (휴대폰 ‘내 녹음’ 탭)
│   ├── script/ · script/[id]/ · script/run/[id]/   MyScript · WebMyScript · MyScriptResult · WebScriptResult
│   ├── share/ · share/[id]/     ListenerShare · WebListeners · ListenerResult
│   ├── l/[code]/                WebListen · 듣는 사람 받아쓰기 (로그인 없음)
│   ├── settings/ (+voice-model/ research/ account/)  Settings · WebSettings · VoiceModel · ResearchMode · 비밀번호
│   ├── offline/                 Offline · WebStates(인터넷 끊김)
│   └── admin/                   관리자 (디자인에 없음 → 같은 톤으로 간단히)
├── components/ui/               Button · Card · Chip · BackHeader · Mascot · Logo · AppShell(하단 4개 / 넓은 화면 왼쪽 7개 + 오늘 띠) · Sheet · Qr · 상태 화면
├── features/
│   ├── auth/                    Field · useAfterLogin
│   ├── marketing/ · onboarding/ Landing · GoalPicker
│   ├── record/                  useAttemptFlow(녹음→검사→업로드/오프라인 보관→분석) · RecordStage · MicButton · LiveBars · HissMeter · HissKHzMeter · SoundShape · IssueBox · OfflineBox · Heard
│   ├── voice/                   발성 연습 그림(글자별 크기·높이 곡선·글자 길이·울림 위치)과 문구
│   ├── vowels/                  Mouth(입모양 애니메이션) · VowelMap(F1·F2 모음 지도)
│   ├── progress/                VowelTriangle · HissDots · 기록 내보내기
│   ├── share/                   ListenerTable (사람 귀 vs 앱)
│   └── settings/                Toggle · RetentionPicker
├── hooks/useRecorder.ts         AudioWorklet 녹음 · 실시간 크기/쉬익 비율/바람 중심 kHz/LPC 모음 점 · 16kHz WAV
├── services/                    api.ts · endpoints.ts · push.ts(웹 푸시 구독)
├── stores/auth.ts               로그인 상태 (Zustand persist)
├── types/api.ts                 API 타입
└── utils/                       audio.ts · hangul.ts · lpc.ts(포먼트) · offline.ts(IndexedDB 보관함)
public/sw.js                     서비스 워커: 푸시 표시 · 화면 네트워크 우선 캐시
```

## 상태 처리
- 서버 데이터: React Query (`['plan']`, `['attempt', id]`, `['progress']` …). 녹음 결과가 반영되면 `['plan']` 무효화.
- Loading → `Loading`(말랑이), Error → `ErrorState`(다시 시도), Empty → `Empty`(다음 할 일 버튼).
- 인터넷 끊김: 녹음 업로드가 `OFFLINE`이면 IndexedDB에 보관 → `OfflineManager`가 30초마다·온라인 될 때 올림(`clientId`로 중복 방지), 상단 띠로 알림.

## 반응형
- 휴대폰(≤767px): 디자인 앱 화면 그대로, 하단 메뉴 4개.
- 넓은 화면(≥1024px): 왼쪽 메뉴 7개(학습·소리 배우기·발성·억양·내 글로 연습·성장 기록·사람 귀 확인·설정) + 위쪽 ‘오늘 3/5’ 띠. 디자인 Web* 보드는 같은 화면 파일 안에서 `lg:` 2단 배치로 만든다(WebHome 대시보드는 별도 컴포넌트).

## 디자인 토큰 (`tailwind.config.ts`)
배경 `#F5F3FC` · 잉크 `#1B1A33` · 보라 `#5B4BFF`/`#3F31D6` · 통과 `#14A06E` · 바뀜(코랄) `#FF6B3D` · 연두(배움) `#D4F2A0` · 글꼴 Jua(제목) + Noto Sans KR(본문, npm으로 내장).
단면도·로고는 디자인 캔버스의 SVG를 `public/`에 그대로 옮겼다.
