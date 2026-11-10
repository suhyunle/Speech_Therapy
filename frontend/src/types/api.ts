export type Role = 'LEARNER' | 'ADMIN';
export type ItemKind = 'SYLLABLE' | 'WORD' | 'SENTENCE' | 'PARAGRAPH';
export type AttemptStatus = 'QUEUED' | 'PROCESSING' | 'DONE' | 'ISSUE' | 'FAILED';
export type AttemptContext = 'MIC_CHECK' | 'PLACEMENT' | 'PRACTICE' | 'BASELINE' | 'WEEKLY' | 'REVIEW' | 'EXERCISE';
export type SoundState = 'LOCKED' | 'LEARNING' | 'LEARNED' | 'ALREADY_GOOD';
export type OpType = 'same' | 'allowed' | 'sub' | 'del' | 'ins' | 'unsure';
export type Issue = 'too_quiet' | 'noisy' | 'too_short' | 'clipped' | 'mismatch' | null;

export interface PublicUser {
  id: string;
  name: string;
  loginId: string | null;
  role: Role;
  isGuest: boolean;
  hasBaseline: boolean;
  onboarded: boolean;
}
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

export interface Settings {
  personalModel: boolean;
  researchMode: boolean;
  researchAudio: boolean;
  irbNumber: string | null;
  dailyGoal: 3 | 5 | 10;
  reminderEnabled: boolean;
  reminderTime: string | null;
  visualAlert: boolean;
  haptics: boolean;
  fontSize: 'NORMAL' | 'LARGE';
  retentionDays: number;
  onboardedAt: string | null;
}

export interface LessonItem {
  id: string;
  kind: ItemKind;
  text: string;
  pronunciation: string;
  note: string | null;
  targetSounds: string[];
}

export interface Phoneme {
  symbol: string;
  pos: 'onset' | 'vowel' | 'coda';
  syl: number;
}
export interface Op {
  target: Phoneme | null;
  got: Phoneme | null;
  type: OpType;
  /** 소리를 직접 재서 판정을 보류한 이유 (no_hiss: 바람 소리 거의 없음, low_hiss: 바람이 낮아 ‘쉬’ 쪽) */
  reason?: 'no_hiss' | 'low_hiss' | 'phone_disagree';
  /** 소리 단위(음소) 모델이 들은 짝 소리 */
  phoneHeard?: string;
}
export interface AnalysisResult {
  target: string;
  targetPronunciation: string;
  quality: { ok: boolean; issue: Issue; speechDb: number; noiseDb: number; snrDb: number | null; speechSec: number; peakDb: number };
  heard: string | null;
  heardPronunciation: string | null;
  phonemes: { ops: Op[]; matched: number; total: number; inserted?: number; diffRatio: number | null } | null;
  soundVerdicts: Record<string, boolean | null> | null;
  measures: {
    intensityDb: number | null;
    pitchHz: number | null;
    pitchContourSt: number[];
    finalSlopeSt: number | null;
    durationSec: number;
    rateSylPerSec: number | null;
    hiss: { centroidKHz: number | null; hissSec: number } | null;
    formants: { f1: number | null; f2: number | null } | null;
    dropDb: number | null;
    endDrop: boolean | null;
    shape?: { t: number; kind: 'voice' | 'wind' | 'silence'; level: number }[];
    syllables?: { t: number; dur: number; db: number }[];
  } | null;
  voice: { loudness: 'low' | 'ok' | 'high' | null; pitch: 'low' | 'ok' | 'high' | null; rate: 'slow' | 'ok' | 'fast' | null; pitchSt?: number; reason: string | null } | null;
  feedback: { headline: string; cheer: string; tip: string | null; next: string } | null;
  passed: boolean | null;
  model: string | null;
  limits: string[];
  baseline?: unknown;
  exercise?: {
    kind: string;
    syllables: { text: string | null; t: number; dur: number; db: number }[];
    aligned: boolean;
    weak?: number[];
    tailDrop?: number;
    missingTail?: boolean;
    ok?: boolean;
    want?: 'up' | 'down';
    finalSlopeSt?: number | null;
    contourSt?: number[];
    intonationOk?: boolean | null;
    totalSec?: number;
    refTotalSec?: number;
    rate?: number | null;
    long?: number[];
    refSylSec?: number;
    resonanceDb?: number | null;
    resonanceDelta?: number;
    position?: number | null;
    distanceRatio?: number;
    loudDeltaDb?: number;
    holdSec?: number;
    reason?: string;
  } | null;
  phoneCheck?: { model: string; checked: number; disagree: { symbol: string; syl: number; heardAs: string }[]; agree: { symbol: string; syl: number; heardAs: string }[] };
  acousticChecks?: { symbol: string; syl: number; reason: 'no_hiss' | 'low_hiss'; hissSec: number; centroidKHz: number | null }[];
  vowelPoint?: { f1: number; f2: number; target: string | null; nearest: string; targets: Record<string, [number, number]>; set: string };
}

export interface Attempt {
  id: string;
  userId: string;
  itemId: string | null;
  targetText: string;
  targetPronunciation: string;
  context: AttemptContext;
  soundSymbol: string | null;
  status: AttemptStatus;
  issue: Issue;
  heard: string | null;
  passed: boolean | null;
  result: AnalysisResult | null;
  modelVersion: string | null;
  createdAt: string;
  recordingId?: string | null;
  tryNumber?: number | null;
  audioAvailable?: boolean;
  item?: { kind: ItemKind; targetSounds: string[]; note: string | null } | null;
}

export interface PathNode {
  symbol: string;
  kind: 'CONSONANT' | 'VOWEL' | 'DIPHTHONG';
  group: string;
  state: SoundState;
  consecutiveFails: number;
}
export interface TodayPlan {
  date: string;
  name: string;
  isGuest: boolean;
  hasBaseline: boolean;
  goal: number;
  completed: number;
  todayRecordings: number;
  thisWeekRecordings: number;
  streak: { current: number; best: number; broken: boolean };
  clearedCount: number;
  groups: { key: string; label: string; done: boolean; current: boolean }[];
  current: PathNode | null;
  path: PathNode[];
  items: { id: string; kind: ItemKind; text: string; note: string | null; done: boolean }[];
  week: { date: string; isToday: boolean; completed: boolean; recordings: number }[];
  warmup: { id: string; text: string; done: boolean } | null;
  baselineNeeded: boolean;
  weeklyDue: string[];
  daysAway: number | null;
  learnedCount: number;
  vowelSet: 'f' | 'm';
  vowelTargets: Record<string, [number, number]> | null;
}

export interface Sound {
  id: string;
  symbol: string;
  kind: 'CONSONANT' | 'VOWEL' | 'DIPHTHONG';
  groupKey: string;
  place: string;
  manner: string;
  voicing: string;
  cue: string;
  guide: { place: string; manner: string; voicing: string; cue: string; steps: string[]; compare?: { symbol: string; text: string } };
  items?: { id: string; kind: ItemKind; text: string; pronunciation: string; note: string | null; status: string; baselineFor: string | null }[];
}

export interface PlacementStart {
  session: { id: string };
  stages: { kind: ItemKind; items: LessonItem[] }[];
}
export interface PlacementSummary {
  cleared: string[];
  practice: string[];
  unknown: string[];
  perSound: Record<string, { syllable: boolean | null; word: boolean | null; sentence: boolean | null }>;
  pcc: { correct: number; total: number } | null;
  pwc: { correct: number; total: number } | null;
  answered: number;
}

export interface ProgressSummary {
  daysSinceFirst: number | null;
  wordsImproved: number | null;
  vowels: { first: Record<string, [number, number]>; latest: Record<string, [number, number]>; areaFirst: number | null; areaLatest: number | null; areaIndex: number | null };
  hissS: { baseline: number[]; after: number[] };
  totalRecordings: number;
  week: { date: string; count: number }[];
  thisWeek: number;
  lastWeek: number;
  placement: { first: { pcc: any; pwc: any; at: string } | null; latest: { pcc: any; pwc: any; at: string } | null; sessions: number };
  sounds: {
    symbol: string;
    state: SoundState;
    attempts: number;
    passes: number;
    first: { id: string; target: string; heard: string | null; passed: boolean | null; at: string; hiss: any } | null;
    latest: { id: string; target: string; heard: string | null; passed: boolean | null; at: string; hiss: any } | null;
  }[];
}

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
  attempts?: number;
  max?: number;
}
