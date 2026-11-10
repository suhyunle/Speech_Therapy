import { api, API_URL } from './api';
import { useAuth } from '@/stores/auth';
import type {
  Attempt,
  AttemptContext,
  PlacementStart,
  PlacementSummary,
  ProgressSummary,
  PublicUser,
  Settings,
  Sound,
  TodayPlan,
  TokenPair,
} from '@/types/api';

export const authApi = {
  checkId: (loginId: string) => api<{ available: boolean; reason: 'format' | 'taken' | null }>(`/auth/check-id?loginId=${encodeURIComponent(loginId)}`),
  signup: (body: object) => api<TokenPair>('/auth/signup', { method: 'POST', json: body }),
  login: (loginId: string, password: string) => api<TokenPair>('/auth/login', { method: 'POST', json: { loginId, password } }),
  guest: () => api<TokenPair>('/auth/guest', { method: 'POST' }),
  me: () => api<PublicUser>('/auth/me'),
  providers: () => api<{ kakao: boolean; google: boolean }>('/auth/providers'),
  oauthUrl: (p: 'kakao' | 'google') => api<{ url: string }>(`/auth/oauth/${p}/url`),
  oauthCallback: (p: 'kakao' | 'google', code: string, state: string) => api<TokenPair>(`/auth/oauth/${p}/callback`, { method: 'POST', json: { code, state } }),
  logout: (refreshToken: string) => api<void>('/auth/logout', { method: 'POST', json: { refreshToken } }),
};

export const meApi = {
  settings: () => api<Settings>('/me/settings'),
  updateSettings: (body: Partial<Settings> & { onboarded?: boolean }) => api<Settings>('/me/settings', { method: 'PATCH', json: body }),
  consents: () => api<Record<string, { granted: boolean; at: string }>>('/me/consents'),
  consent: (type: 'VOICE_RECORDING' | 'MODEL_TRAINING' | 'RESEARCH', granted: boolean) => api('/me/consents', { method: 'POST', json: { type, granted } }),
  deleteRecordings: () => api<{ deleted: number }>('/me/recordings', { method: 'DELETE' }),
  deleteAccount: () => api<void>('/me', { method: 'DELETE' }),
};

export const contentApi = {
  sounds: () => api<Sound[]>('/sounds'),
  sound: (symbol: string) => api<Sound>(`/sounds/${encodeURIComponent(symbol)}`),
  item: (id: string) => api<{ id: string; kind: string; text: string; pronunciation: string; note: string | null; targetSounds: string[] }>(`/items/${id}`),
};

export const placementApi = {
  start: () => api<PlacementStart>('/placement', { method: 'POST' }),
  finish: (id: string) => api<PlacementSummary>(`/placement/${id}/finish`, { method: 'POST' }),
  latest: () => api<{ id: string; summary: PlacementSummary | null; finishedAt: string } | null>('/placement/latest'),
};

export const planApi = { today: () => api<TodayPlan>('/plan/today') };
export const progressApi = { summary: () => api<ProgressSummary>('/progress') };

export const attemptsApi = {
  create: (wav: Blob, meta: { context: AttemptContext; itemId?: string; placementSessionId?: string; soundSymbol?: string; text?: string; clientId?: string; durationMs: number }) => {
    const fd = new FormData();
    fd.append('context', meta.context);
    if (meta.itemId) fd.append('itemId', meta.itemId);
    if (meta.placementSessionId) fd.append('placementSessionId', meta.placementSessionId);
    if (meta.soundSymbol) fd.append('soundSymbol', meta.soundSymbol);
    if (meta.text) fd.append('text', meta.text);
    if (meta.clientId) fd.append('clientId', meta.clientId);
    fd.append('durationMs', String(Math.round(meta.durationMs)));
    fd.append('device', navigator.userAgent.slice(0, 190));
    fd.append('audio', wav, 'recording.wav');
    return api<Attempt>('/attempts', { method: 'POST', body: fd });
  },
  get: (id: string) => api<Attempt>(`/attempts/${id}`),
  list: (sound?: string, limit = 30) => api<Attempt[]>(`/attempts?limit=${limit}${sound ? `&sound=${encodeURIComponent(sound)}` : ''}`),
  report: (id: string, reason: string) => api(`/attempts/${id}/report`, { method: 'POST', json: { reason } }),
  /** SSE로 분석 진행을 받는다. 연결이 안 되면 1초마다 조회한다. */
  waitFor: (id: string, onStatus: (s: string) => void, timeoutMs = 30_000): Promise<Attempt> =>
    new Promise((resolve, reject) => {
      const final = ['DONE', 'ISSUE', 'FAILED'];
      let done = false;
      const finish = async () => {
        if (done) return;
        done = true;
        es?.close();
        clearInterval(poll);
        clearTimeout(timer);
        try {
          resolve(await attemptsApi.get(id));
        } catch (e) {
          reject(e);
        }
      };
      const token = useAuth.getState().accessToken;
      let es: EventSource | null = null;
      try {
        es = new EventSource(`${API_URL}/attempts/${id}/events?access_token=${encodeURIComponent(token ?? '')}`);
        es.onmessage = (ev) => {
          const d = JSON.parse(ev.data);
          onStatus(d.status);
          if (final.includes(d.status)) void finish();
        };
        es.onerror = () => es?.close();
      } catch {
        es = null;
      }
      const poll = setInterval(async () => {
        try {
          const a = await attemptsApi.get(id);
          onStatus(a.status);
          if (final.includes(a.status)) void finish();
        } catch {
          /* 다음 조회에서 다시 */
        }
      }, 1500);
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        es?.close();
        clearInterval(poll);
        reject(new Error('분석이 늦어지고 있어요. 잠시 후 내 녹음에서 확인해 주세요'));
      }, timeoutMs);
    }),
};

export const diaryApi = {
  today: () => api<{ date: string; entry: { feeling: string | null; note: string | null } | null; recordings: number; completed: number; goal: number | null }>('/diary/today'),
  save: (body: { feeling?: string; note?: string }) => api('/diary/today', { method: 'PUT', json: body }),
};

export const listenApi = {
  create: (attemptIds: string[], group: string) => api<{ id: string; code: string; expiresAt: string }>('/listen-links', { method: 'POST', json: { attemptIds, group } }),
  mine: () => api<any[]>('/listen-links'),
  revoke: (id: string) => api(`/listen-links/${id}`, { method: 'DELETE' }),
  info: (code: string) => api<{ count: number; expiresAt: string; listenerKey: string; items: { order: number; durationMs: number | null }[] }>(`/l/${code}`),
  audioPath: (code: string, order: number) => `${API_URL}/l/${code}/items/${order}/audio`,
  answer: (code: string, body: object) => api<{ ok: boolean; remaining: number }>(`/l/${code}/answers`, { method: 'POST', json: body }),
  reveal: (code: string, key: string) => api<{ order: number; target: string; yours: string | null }[]>(`/l/${code}/reveal?listenerKey=${key}`),
};

export const adminApi = {
  stats: () => api<Record<string, number>>('/admin/stats'),
  items: (q: Record<string, string>) => api<any[]>(`/admin/items?${new URLSearchParams(Object.entries(q).filter(([, v]) => v))}`),
  create: (body: object) => api('/admin/items', { method: 'POST', json: body }),
  update: (id: string, body: object) => api(`/admin/items/${id}`, { method: 'PATCH', json: body }),
  remove: (id: string) => api(`/admin/items/${id}`, { method: 'DELETE' }),
  review: (id: string) => api(`/admin/items/${id}/review`, { method: 'POST' }),
  reports: () => api<any[]>('/admin/reports'),
  resolve: (id: string) => api(`/admin/reports/${id}/resolve`, { method: 'POST' }),
};

export interface ReviewItem { symbol: string; state: string; manner: string; lastAt: string; tip: string | null; item: { id: string; text: string; note: string | null }; done: boolean }
export interface BaselineStatus { symbol: string; repeat: number; done: boolean; items: { id: string; text: string; note: string | null; count: number }[]; next: { id: string; text: string; count: number } | null }
export interface WeeklyStatus { symbol: string; due: boolean; baselineDoneAt: string | null; weeklyDoneAt: string | null; improved: number; rows: { itemId: string; text: string; baselineHeard: string | null; nowHeard: string | null; baselineMatched: number | null; nowMatched: number | null; total: number | null; recordedNow: boolean; verdict: 'better' | 'same' | 'worse' | null }[] }
export interface ExerciseItem { id: string; text: string; pronunciation: string; note: string | null; intonation: 'up' | 'down' | null; last: { id: string; heard: string | null; result: any; createdAt: string } | null; previous: { id: string; result: any } | null }

export const trainingApi = {
  review: () => api<ReviewItem[]>('/review'),
  baseline: (s: string) => api<BaselineStatus>(`/baseline/${encodeURIComponent(s)}`),
  weeklyDue: () => api<{ symbol: string; since: string }[]>('/weekly'),
  weekly: (s: string) => api<WeeklyStatus>(`/weekly/${encodeURIComponent(s)}`),
  exercises: () => api<Record<'forward' | 'endclear' | 'intonation' | 'timing' | 'hiss', ExerciseItem[]>>('/exercises'),
};

export interface ScriptDoc { id: string; title: string; sourceType: string; status: 'EXTRACTING' | 'READY' | 'FAILED'; slides: { n: number; text: string }[] | null; charCount: number; error: string | null; createdAt: string; runs?: { id: string; status: string; createdAt: string; slideFrom: number; slideTo: number; durationMs: number }[] }
export const scriptsApi = {
  list: () => api<ScriptDoc[]>('/scripts'),
  get: (id: string) => api<ScriptDoc>(`/scripts/${id}`),
  createText: (text: string, title?: string) => {
    const fd = new FormData();
    fd.append('text', text);
    if (title) fd.append('title', title);
    return api<ScriptDoc>('/scripts', { method: 'POST', body: fd });
  },
  createFile: (file: File) => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return api<ScriptDoc>('/scripts', { method: 'POST', body: fd });
  },
  remove: (id: string) => api<void>(`/scripts/${id}`, { method: 'DELETE' }),
  createRun: (id: string, audio: Blob, name: string, slideFrom: number, slideTo: number, freeSpeech: boolean) => {
    const fd = new FormData();
    fd.append('slideFrom', String(slideFrom));
    fd.append('slideTo', String(slideTo));
    fd.append('freeSpeech', String(freeSpeech));
    fd.append('audio', audio, name);
    return api<{ id: string }>(`/scripts/${id}/runs`, { method: 'POST', body: fd });
  },
  run: (id: string) => api<{ id: string; status: string; result: any; error: string | null; slideFrom: number; slideTo: number; durationMs: number; doc: { title: string; slides: { n: number; text: string }[] } }>(`/script-runs/${id}`),
};

export const notifyApi = {
  key: () => api<{ enabled: boolean; key: string | null }>('/push/key'),
  subscribe: (sub: PushSubscriptionJSON) => api('/push/subscribe', { method: 'POST', json: { endpoint: sub.endpoint, keys: sub.keys } }),
  unsubscribe: () => api<void>('/push/subscribe', { method: 'DELETE' }),
  test: () => api<{ sent: number; total: number }>('/push/test', { method: 'POST' }),
  newsletter: (email: string) => api<{ ok: boolean }>('/newsletter', { method: 'POST', json: { email } }),
};

export const accountApi = {
  voiceModel: () => api<{ enabled: boolean; recordings: number; goal: number; retentionDays: number; calibration: any }>('/me/voice-model'),
  setVoiceModel: (enabled: boolean) => api<{ enabled: boolean; recordings: number; goal: number; retentionDays: number; calibration: any }>('/me/voice-model', { method: 'POST', json: { enabled } }),
  identities: () => api<{ loginId: string | null; providers: { provider: 'KAKAO' | 'GOOGLE'; email: string | null; createdAt: string }[] }>('/me/identities'),
  linkUrl: (p: 'kakao' | 'google') => api<{ url: string }>(`/auth/oauth/${p}/url?link=1`),
  exportZip: async (audio: boolean) => {
    const res = await api<Response>(`/me/export${audio ? '?audio=1' : ''}`, { raw: true });
    return res.blob();
  },
};

export const passwordApi = {
  change: (body: { current?: string; next: string; loginId?: string }) => api<TokenPair>('/auth/password', { method: 'POST', json: body }),
};
