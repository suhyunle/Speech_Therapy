/**
 * API 통합 테스트 — 실제 PostgreSQL(테스트 DB)·Redis에 붙여서 돌린다.
 * 분석 워커 대신 테스트가 Attempt 결과를 직접 써서(워커와 같은 형식) 진도 반영을 확인한다.
 * 실행: TEST_DATABASE_URL=postgresql://.../malang_test npm run test:e2e
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';

const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@localhost:5432/malang_test';
process.env.DATABASE_URL = DB;
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1'; // 개발용 워커와 대기열을 나눈다
process.env.JOB_QUEUE = 'malang:test:jobs';
process.env.JWT_SECRET = 'test-secret';
process.env.RECORDING_KEY = Buffer.alloc(32, 3).toString('base64');
process.env.STORAGE_DIR = join(__dirname, '..', '.test-storage');
process.env.ADMIN_LOGIN_ID = 'admin';
process.env.ADMIN_PASSWORD = 'admin-pass-1234';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AppModule } = require('../src/app.module');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { configureApp } = require('../src/main');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaService } = require('../src/common/prisma.service');

function wav(seconds = 1, rate = 16000) {
  const n = Math.floor(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 200 * i) / rate)), 44 + i * 2);
  return b;
}

describe('말랑말랑 API (e2e)', () => {
  let app: INestApplication;
  let prisma: any;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const psql = (sql: string) => execSync(`psql "${DB.split('?')[0]}" -v ON_ERROR_STOP=1 -q`, { input: sql });
    psql('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    const migDir = join(__dirname, '../prisma/migrations');
    for (const m of readdirSync(migDir).filter((d) => /^\d/.test(d)).sort()) psql(readFileSync(join(migDir, m, 'migration.sql'), 'utf8'));
    execSync('npx ts-node prisma/seed.ts', { cwd: join(__dirname, '..'), env: { ...process.env }, stdio: 'ignore' });
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(mod.createNestApplication());
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => app?.close());

  const signup = (loginId: string, extra: object = {}) =>
    http().post('/api/auth/signup').send({ loginId, password: 'abcd1234', name: '테스트', agreeTerms: true, ...extra });

  describe('회원가입 · 로그인', () => {
    it('입력 검사: 비밀번호 규칙, 약관 동의', async () => {
      expect((await signup('user_a', { password: 'short' })).status).toBe(400);
      const r = await signup('user_a', { agreeTerms: false });
      expect(r.status).toBe(400);
      expect(r.body.message).toContain('동의');
    });
    it('가입 → 아이디 중복 확인 → 같은 아이디 가입은 409', async () => {
      const r = await signup('user_a');
      expect(r.status).toBe(201);
      expect(r.body.user).toMatchObject({ name: '테스트', isGuest: false, onboarded: false });
      expect((await http().get('/api/auth/check-id?loginId=user_a')).body.available).toBe(false);
      expect((await signup('user_a')).status).toBe(409);
    });
    it('만 14세 미만은 보호자 동의가 필요', async () => {
      const young = new Date().getFullYear() - 10;
      const r = await signup('kid_01', { birthYear: young });
      expect(r.body.code).toBe('GUARDIAN_REQUIRED');
      const ok = await signup('kid_01', { birthYear: young, guardianName: '보호자', guardianContact: '010-0000-0000', guardianAgree: true });
      expect(ok.status).toBe(201);
      const c = await prisma.consent.findFirst({ where: { userId: ok.body.user.id, type: 'GUARDIAN' } });
      expect(c.guardianName).toBe('보호자');
    });
    it('틀리면 같은 문구, 5번 틀리면 잠금', async () => {
      await signup('lock_me');
      for (let i = 1; i <= 4; i++) {
        const r = await http().post('/api/auth/login').send({ loginId: 'lock_me', password: 'wrong1234' });
        expect(r.status).toBe(401);
        expect(r.body.message).toBe('아이디 또는 비밀번호가 맞지 않아요');
      }
      const fifth = await http().post('/api/auth/login').send({ loginId: 'lock_me', password: 'wrong1234' });
      expect(fifth.body.code).toBe('LOCKED');
      const right = await http().post('/api/auth/login').send({ loginId: 'lock_me', password: 'abcd1234' });
      expect(right.body.code).toBe('LOCKED');
      const none = await http().post('/api/auth/login').send({ loginId: 'nobody', password: 'abcd1234' });
      expect(none.body.message).toBe('아이디 또는 비밀번호가 맞지 않아요');
    });
    it('리프레시 토큰 회전 · 재사용하면 묶음 전체 폐기', async () => {
      const login = await http().post('/api/auth/login').send({ loginId: 'user_a', password: 'abcd1234' });
      expect(login.status).toBe(200);
      const r1 = await http().post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken });
      expect(r1.status).toBe(200);
      const reuse = await http().post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken });
      expect(reuse.status).toBe(401);
      const r2 = await http().post('/api/auth/refresh').send({ refreshToken: r1.body.refreshToken });
      expect(r2.status).toBe(401); // 같은 묶음이라 함께 폐기됨
    });
    it('게스트로 진단 후 가입하면 같은 계정을 이어받는다', async () => {
      const g = await http().post('/api/auth/guest');
      const r = await http().post('/api/auth/signup').set('Authorization', `Bearer ${g.body.accessToken}`).send({ loginId: 'from_guest', password: 'abcd1234', name: '손님에서', agreeTerms: true });
      expect(r.body.user.id).toBe(g.body.user.id);
      expect(r.body.user.isGuest).toBe(false);
    });
    it('비밀번호 바꾸기: 지금 비밀번호가 맞아야 하고, 바꾸면 다른 기기 로그인은 끊긴다', async () => {
      const r = await signup('pw_user');
      const t0 = r.body.accessToken;
      expect((await http().post('/api/auth/password').set('Authorization', `Bearer ${t0}`).send({ current: 'wrong123', next: 'newpass123' })).status).toBe(401);
      const ok = await http().post('/api/auth/password').set('Authorization', `Bearer ${t0}`).send({ current: 'abcd1234', next: 'newpass123' });
      expect(ok.status).toBe(201);
      expect((await http().post('/api/auth/refresh').send({ refreshToken: r.body.refreshToken })).status).toBe(401);
      expect((await http().post('/api/auth/login').send({ loginId: 'pw_user', password: 'newpass123' })).status).toBe(200);
    });
    it('카카오·구글 키가 없으면 준비 중', async () => {
      expect((await http().get('/api/auth/providers')).body).toEqual({ kakao: false, google: false });
      expect((await http().get('/api/auth/oauth/kakao/url')).status).toBe(503);
    });
  });

  describe('권한', () => {
    let a: string;
    let b: string;
    let attemptId: string;
    let itemId: string;
    beforeAll(async () => {
      a = (await http().post('/api/auth/login').send({ loginId: 'user_a', password: 'abcd1234' })).body.accessToken;
      b = (await signup('user_b')).body.accessToken;
      itemId = (await prisma.lessonItem.findFirst({ where: { text: '사과', kind: 'WORD' } })).id;
    });
    it('로그인 없이는 401', async () => {
      expect((await http().get('/api/plan/today')).status).toBe(401);
    });
    it('목소리 녹음 동의 전에는 녹음을 받지 않는다', async () => {
      const r = await http().post('/api/attempts').set('Authorization', `Bearer ${a}`).field('context', 'PRACTICE').field('itemId', itemId).field('durationMs', '1000').attach('audio', wav(), 'a.wav');
      expect(r.body.code).toBe('VOICE_CONSENT_REQUIRED');
    });
    it('녹음 업로드 → 대기열 → 원본은 암호화 저장', async () => {
      await http().post('/api/me/consents').set('Authorization', `Bearer ${a}`).send({ type: 'VOICE_RECORDING', granted: true });
      const r = await http().post('/api/attempts').set('Authorization', `Bearer ${a}`).field('context', 'PRACTICE').field('itemId', itemId).field('soundSymbol', 'ㅅ').field('durationMs', '1000').attach('audio', wav(), 'a.wav');
      expect(r.status).toBe(201);
      expect(r.body.status).toBe('QUEUED');
      attemptId = r.body.id;
      const rec = await prisma.recording.findFirst({ where: { userId: r.body.userId } });
      const raw = readFileSync(join(process.env.STORAGE_DIR!, rec.storageKey));
      expect(raw.subarray(0, 4).toString('ascii')).not.toBe('RIFF');
      const audio = await http().get(`/api/attempts/${attemptId}/audio`).set('Authorization', `Bearer ${a}`);
      expect(audio.body.subarray(0, 4).toString('ascii')).toBe('RIFF');
    });
    it('WAV가 아니면 400', async () => {
      const r = await http().post('/api/attempts').set('Authorization', `Bearer ${a}`).field('context', 'PRACTICE').field('itemId', itemId).field('durationMs', '1000').attach('audio', Buffer.from('hello world, not audio at all...............'), 'x.wav');
      expect(r.status).toBe(400);
    });
    it('남의 녹음·결과는 볼 수 없다', async () => {
      expect((await http().get(`/api/attempts/${attemptId}`).set('Authorization', `Bearer ${b}`)).status).toBe(404);
      expect((await http().get(`/api/attempts/${attemptId}/audio`).set('Authorization', `Bearer ${b}`)).status).toBe(404);
    });
    it('관리자가 아니면 관리자 API 403', async () => {
      expect((await http().get('/api/admin/items').set('Authorization', `Bearer ${a}`)).status).toBe(403);
    });
    it('분석 결과가 오면 오늘 기록·소리 진도에 한 번만 반영', async () => {
      const ops = [
        { target: { symbol: 'ㅅ', pos: 'onset', syl: 0 }, got: { symbol: 'ㄷ', pos: 'onset', syl: 0 }, type: 'sub' },
        { target: { symbol: 'ㅏ', pos: 'vowel', syl: 0 }, got: { symbol: 'ㅏ', pos: 'vowel', syl: 0 }, type: 'same' },
      ];
      await prisma.attempt.update({ where: { id: attemptId }, data: { status: 'DONE', heard: '다과', passed: false, result: { phonemes: { ops, matched: 1, total: 2 } } } });
      const g1 = await http().get(`/api/attempts/${attemptId}`).set('Authorization', `Bearer ${a}`);
      expect(g1.body.heard).toBe('다과');
      await http().get(`/api/attempts/${attemptId}`).set('Authorization', `Bearer ${a}`);
      const plan = await http().get('/api/plan/today').set('Authorization', `Bearer ${a}`);
      expect(plan.body.todayRecordings).toBe(1);
      const sp = await prisma.soundProgress.findFirst({ where: { user: { loginId: 'user_a' }, sound: { symbol: 'ㅅ' } } });
      expect(sp).toMatchObject({ attempts: 1, passes: 0, consecutiveFails: 1, state: 'LEARNING' });
    });
  });

  describe('진단 · 오늘의 학습', () => {
    let t: string;
    beforeAll(async () => {
      t = (await signup('placer')).body.accessToken;
    });
    it('진단 문항: 글자 23 · 단어 8 · 문장 3', async () => {
      const r = await http().post('/api/placement').set('Authorization', `Bearer ${t}`);
      expect(r.body.stages.map((s: any) => s.items.length)).toEqual([23, 8, 3]);
    });
    it('오늘의 학습: 목표 5개 = 단어 4 + 문장 1, 홈 경로 40개 소리', async () => {
      const r = await http().get('/api/plan/today').set('Authorization', `Bearer ${t}`);
      expect(r.body.goal).toBe(5);
      expect(r.body.items).toHaveLength(5);
      expect(r.body.path).toHaveLength(40);
      expect(r.body.current.symbol).toBe('ㅣ');
      await http().patch('/api/me/settings').set('Authorization', `Bearer ${t}`).send({ dailyGoal: 10 }).expect(200);
      const r2 = await http().get('/api/plan/today').set('Authorization', `Bearer ${t}`);
      expect(r2.body.items.length).toBeGreaterThanOrEqual(7);
    });
    it('설정 값 검사', async () => {
      expect((await http().patch('/api/me/settings').set('Authorization', `Bearer ${t}`).send({ dailyGoal: 7 })).status).toBe(400);
      expect((await http().patch('/api/me/settings').set('Authorization', `Bearer ${t}`).send({ reminderTime: '25:00' })).status).toBe(400);
    });
  });

  describe('관리자 콘텐츠 CRUD', () => {
    let t: string;
    let id: string;
    beforeAll(async () => {
      t = (await http().post('/api/auth/login').send({ loginId: 'admin', password: 'admin-pass-1234' })).body.accessToken;
    });
    it('등록 → 검토 → 정답을 고치면 다시 검토 전 → 삭제', async () => {
      const c = await http().post('/api/admin/items').set('Authorization', `Bearer ${t}`).send({ kind: 'WORD', text: '수건', pronunciation: '수건', targetSounds: ['ㅅ'] });
      expect(c.status).toBe(201);
      expect(c.body.status).toBe('DRAFT');
      id = c.body.id;
      const rv = await http().post(`/api/admin/items/${id}/review`).set('Authorization', `Bearer ${t}`);
      expect(rv.body.status).toBe('REVIEWED');
      const up = await http().patch(`/api/admin/items/${id}`).set('Authorization', `Bearer ${t}`).send({ pronunciation: '수건' });
      expect(up.body.status).toBe('DRAFT');
      const list = await http().get('/api/admin/items?search=수건').set('Authorization', `Bearer ${t}`);
      expect(list.body).toHaveLength(1);
      expect((await http().delete(`/api/admin/items/${id}`).set('Authorization', `Bearer ${t}`)).status).toBe(200);
      expect((await http().patch(`/api/admin/items/${id}`).set('Authorization', `Bearer ${t}`).send({ note: 'x' })).status).toBe(404);
    });
  });

  describe('사람 귀 확인 링크', () => {
    it('듣는 사람에게 정답을 주지 않고, 다 답한 뒤에만 공개', async () => {
      const t = (await http().post('/api/auth/login').send({ loginId: 'user_a', password: 'abcd1234' })).body.accessToken;
      const done = await prisma.attempt.findFirst({ where: { user: { loginId: 'user_a' }, status: 'DONE' } });
      const link = await http().post('/api/listen-links').set('Authorization', `Bearer ${t}`).send({ attemptIds: [done.id], group: 'FAMILY' });
      expect(link.status).toBe(201);
      const info = await http().get(`/api/l/${link.body.code}`);
      expect(JSON.stringify(info.body)).not.toContain('사과');
      const key = info.body.listenerKey;
      expect((await http().get(`/api/l/${link.body.code}/reveal?listenerKey=${key}`)).status).toBe(400);
      const ans = await http().post(`/api/l/${link.body.code}/answers`).send({ listenerKey: key, order: 1, answerText: '다과', unsure: false, familiarity: 'OFTEN' });
      expect(ans.status).toBe(201);
      const rev = await http().get(`/api/l/${link.body.code}/reveal?listenerKey=${key}`);
      expect(rev.body[0]).toMatchObject({ target: '사과', yours: '다과' });
      await http().delete(`/api/listen-links/${link.body.id}`).set('Authorization', `Bearer ${t}`).expect(200);
      expect((await http().get(`/api/l/${link.body.code}`)).status).toBe(410);
    });
  });

  describe('개인정보', () => {
    it('내 녹음 전부 지우기 → 원본 재생 불가, 결과 글자는 남음', async () => {
      const t = (await http().post('/api/auth/login').send({ loginId: 'user_a', password: 'abcd1234' })).body.accessToken;
      const r = await http().delete('/api/me/recordings').set('Authorization', `Bearer ${t}`);
      expect(r.body.deleted).toBeGreaterThan(0);
      const a = await prisma.attempt.findFirst({ where: { user: { loginId: 'user_a' }, status: 'DONE' } });
      expect((await http().get(`/api/attempts/${a.id}/audio`).set('Authorization', `Bearer ${t}`)).status).toBe(410);
      expect((await http().get(`/api/attempts/${a.id}`).set('Authorization', `Bearer ${t}`)).body.heard).toBe('다과');
    });
    it('계정 삭제 → 데이터 함께 삭제', async () => {
      const r = await signup('bye_user');
      await http().delete('/api/me').set('Authorization', `Bearer ${r.body.accessToken}`).expect(204);
      expect(await prisma.user.findUnique({ where: { loginId: 'bye_user' } })).toBeNull();
    });
  });

  describe('복습 · 기초선 · 일주일 · 발성 · 원고 · 알림 · 내보내기', () => {
    let t: string;
    let uid: string;
    beforeAll(async () => {
      const r = await signup('full_user');
      t = r.body.accessToken;
      uid = r.body.user.id;
      await http().post('/api/me/consents').set('Authorization', `Bearer ${t}`).send({ type: 'VOICE_RECORDING', granted: true });
    });
    const up = (fields: Record<string, string>) => {
      let req = http().post('/api/attempts').set('Authorization', `Bearer ${t}`);
      for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
      return req.attach('audio', wav(), 'a.wav');
    };
    const finish = async (id: string, matched = 2, total = 4) => {
      await prisma.attempt.update({ where: { id }, data: { status: 'DONE', heard: '다과', result: { phonemes: { ops: [], matched, total } } } });
      await http().get(`/api/attempts/${id}`).set('Authorization', `Bearer ${t}`);
    };

    it('기초선: 단어 3개 × 3번 하면 끝, 일주일 지나면 체크 대상', async () => {
      const b0 = await http().get('/api/baseline/' + encodeURIComponent('ㅅ')).set('Authorization', `Bearer ${t}`);
      expect(b0.body.items).toHaveLength(3);
      expect(b0.body.done).toBe(false);
      for (const it of b0.body.items) for (let k = 0; k < 3; k++) await finish((await up({ context: 'BASELINE', itemId: it.id, soundSymbol: 'ㅅ', durationMs: '1000' })).body.id);
      const b1 = await http().get('/api/baseline/' + encodeURIComponent('ㅅ')).set('Authorization', `Bearer ${t}`);
      expect(b1.body.done).toBe(true);
      // 기초선은 소리 진도에 반영하지 않는다
      const sp = await prisma.soundProgress.findFirst({ where: { userId: uid, sound: { symbol: 'ㅅ' } } });
      expect(sp.attempts).toBe(0);
      await prisma.soundProgress.update({ where: { userId_soundId: { userId: uid, soundId: sp.soundId } }, data: { baselineDoneAt: new Date(Date.now() - 8 * 86400_000) } });
      const due = await http().get('/api/weekly').set('Authorization', `Bearer ${t}`);
      expect(due.body.map((d: any) => d.symbol)).toContain('ㅅ');
      for (const it of b0.body.items) await finish((await up({ context: 'WEEKLY', itemId: it.id, soundSymbol: 'ㅅ', durationMs: '1000' })).body.id, 4, 4);
      const w = await http().get('/api/weekly/' + encodeURIComponent('ㅅ')).set('Authorization', `Bearer ${t}`);
      expect(w.body.improved).toBe(3);
      expect(w.body.due).toBe(false);
    });
    it('직접 정한 글자로 녹음 · 같은 clientId는 한 번만', async () => {
      const a = await up({ context: 'PRACTICE', text: '사업', durationMs: '1000', clientId: 'dev-1' });
      expect(a.status).toBe(201);
      expect(a.body.targetText).toBe('사업');
      const again = await up({ context: 'PRACTICE', text: '사업', durationMs: '1000', clientId: 'dev-1' });
      expect(again.body.id).toBe(a.body.id);
    });
    it('발성 연습 문항 · 오늘의 학습에 발성 1분과 억양 단계', async () => {
      const ex = await http().get('/api/exercises').set('Authorization', `Bearer ${t}`);
      expect(Object.keys(ex.body)).toEqual(expect.arrayContaining(['forward', 'endclear', 'intonation', 'timing', 'hiss']));
      expect(ex.body.intonation.find((i: any) => i.text === '밥 먹었어?').intonation).toBe('up');
      const plan = await http().get('/api/plan/today').set('Authorization', `Bearer ${t}`);
      expect(plan.body.warmup.text).toBe('음——');
      expect(plan.body.groups.map((g: any) => g.key)).toContain('prosody');
      expect(plan.body.items.every((i: any) => !['음——', '스—'].includes(i.text))).toBe(true);
    });
    it('복습: 배운 소리에서 3개', async () => {
      const sounds = await prisma.sound.findMany({ where: { symbol: { in: ['ㅁ', 'ㅂ', 'ㄹ'] } } });
      for (const s of sounds) await prisma.soundProgress.upsert({ where: { userId_soundId: { userId: uid, soundId: s.id } }, create: { userId: uid, soundId: s.id, state: 'LEARNED' }, update: { state: 'LEARNED' } });
      const r = await http().get('/api/review').set('Authorization', `Bearer ${t}`);
      expect(r.body).toHaveLength(3);
      expect(r.body[0].item.text).toBeTruthy();
    });
    it('내 글로 연습: 붙여넣은 글 → 슬라이드 → 녹음 올리기', async () => {
      const d = await http().post('/api/scripts').set('Authorization', `Bearer ${t}`).field('text', '안녕하세요. 발표를 시작하겠습니다.\n\n감사합니다.');
      expect(d.status).toBe(201);
      expect(d.body.status).toBe('READY');
      expect(d.body.slides).toHaveLength(2);
      const run = await http().post(`/api/scripts/${d.body.id}/runs`).set('Authorization', `Bearer ${t}`).field('slideFrom', '1').field('slideTo', '9').field('freeSpeech', 'true').attach('audio', wav(2), 'talk.wav');
      expect(run.status).toBe(201);
      expect(run.body.slideTo).toBe(2);
      // 원고 화면: 지난 연습 목록을 함께 주고, 저장 위치는 주지 않는다
      const got = await http().get(`/api/scripts/${d.body.id}`).set('Authorization', `Bearer ${t}`);
      expect(got.body.runs.map((r: any) => r.id)).toContain(run.body.id);
      expect(got.body.storageKey).toBeUndefined();
      const bad = await http().post('/api/scripts').set('Authorization', `Bearer ${t}`).attach('file', Buffer.from('hello'), 'memo.docx');
      expect(bad.status).toBe(400);
      expect((await http().delete(`/api/scripts/${d.body.id}`).set('Authorization', `Bearer ${t}`)).status).toBe(204);
      expect((await http().get(`/api/script-runs/${run.body.id}`).set('Authorization', `Bearer ${t}`)).status).toBe(404);
    });
    it('출시 소식 신청 · 알림 키', async () => {
      expect((await http().post('/api/newsletter').send({ email: 'not-an-email' })).status).toBe(400);
      expect((await http().post('/api/newsletter').send({ email: 'Me@Example.com' })).status).toBe(201);
      expect(await prisma.newsletterSignup.findUnique({ where: { email: 'me@example.com' } })).not.toBeNull();
      expect((await http().get('/api/push/key')).body).toHaveProperty('enabled');
    });
    it('내 목소리에 맞추기: 켜면 동의 기록, 끄면 개인 기준 삭제', async () => {
      const on = await http().post('/api/me/voice-model').set('Authorization', `Bearer ${t}`).send({ enabled: true });
      expect(on.body.enabled).toBe(true);
      await prisma.user.update({ where: { id: uid }, data: { calibration: { vowels: { ㅏ: [900, 1500] } } } });
      const off = await http().post('/api/me/voice-model').set('Authorization', `Bearer ${t}`).send({ enabled: false });
      expect(off.body.enabled).toBe(false);
      expect(off.body.calibration).toBeNull();
      const c = await http().get('/api/me/consents').set('Authorization', `Bearer ${t}`);
      expect(c.body.MODEL_TRAINING.granted).toBe(false);
    });
    it('보관 기간 “내가 지울 때까지” · 기록 내보내기 zip', async () => {
      await http().patch('/api/me/settings').set('Authorization', `Bearer ${t}`).send({ retentionDays: 0, researchMode: true }).expect(200);
      const r = await prisma.recording.findFirst({ where: { userId: uid } });
      expect(r.expiresAt.getUTCFullYear()).toBe(9999);
      const z = await http().get('/api/me/export?audio=1').set('Authorization', `Bearer ${t}`).buffer(true).parse((res, cb) => { const b: Buffer[] = []; res.on('data', (c: Buffer) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });
      expect(z.status).toBe(200);
      expect(z.headers['content-type']).toContain('zip');
      expect((z.body as Buffer).subarray(0, 2).toString()).toBe('PK');
      expect((z.body as Buffer).includes(Buffer.from('recordings.csv'))).toBe(true);
      expect((z.body as Buffer).includes(Buffer.from('audio/'))).toBe(true);
    });
    it('연결된 로그인 방법', async () => {
      const r = await http().get('/api/me/identities').set('Authorization', `Bearer ${t}`);
      expect(r.body).toEqual({ loginId: 'full_user', providers: [] });
    });
  });
});
