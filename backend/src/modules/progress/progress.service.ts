import { Injectable, Logger } from '@nestjs/common';
import { Attempt, AttemptContext, AttemptStatus, SoundState } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { addDays, mondayOf, seoulDate } from '../../common/util';

/** 소리를 '배웠어요'로 바꾸는 기준: 서로 다른 문항 3개 이상에서 통과 4번 이상 */
export const LEARNED_MIN_PASSES = 4;
export const LEARNED_MIN_ITEMS = 3;
export const COUNTED: AttemptContext[] = [AttemptContext.PRACTICE, AttemptContext.BASELINE, AttemptContext.WEEKLY, AttemptContext.REVIEW, AttemptContext.EXERCISE];

export interface OpLike {
  target: { symbol: string; pos: string } | null;
  type: string;
}

/** 분석 결과의 한 소리씩 비교에서 소리별 판정. 첫소리·모음만 본다(받침은 조음이 달라 따로 셈하지 않음). ㅇ은 받침에서만 소리가 나서 받침으로 본다. */
export function verdictsFromOps(ops: OpLike[] | undefined | null): Record<string, boolean | null> {
  const out: Record<string, boolean | null> = {};
  for (const o of ops ?? []) {
    if (!o.target || (o.target.pos === 'coda' && o.target.symbol !== 'ㅇ')) continue;
    const s = o.target.symbol;
    if (o.type === 'unsure') {
      if (!(s in out)) out[s] = null;
      continue;
    }
    const ok = o.type === 'same' || o.type === 'allowed';
    out[s] = out[s] === false ? false : ok && out[s] !== false;
  }
  return out;
}

@Injectable()
export class ProgressService {
  private readonly log = new Logger('Progress');
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  /** 분석이 끝난 시도를 오늘 기록·연속 기록·소리 진도에 한 번만 반영한다 */
  async apply(attemptId: string) {
    const claimed = await this.prisma.attempt.updateMany({
      where: { id: attemptId, appliedAt: null, status: { in: [AttemptStatus.DONE, AttemptStatus.ISSUE, AttemptStatus.FAILED] } },
      data: { appliedAt: new Date() },
    });
    if (claimed.count === 0) return;
    const a = await this.prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (a.status !== AttemptStatus.DONE) return;
    // 내 목소리에 맞추기를 켰으면 녹음 20개마다 개인 기준을 다시 계산한다
    const st = await this.prisma.settings.findUnique({ where: { userId: a.userId }, select: { personalModel: true } });
    if (st?.personalModel) {
      const n = await this.prisma.attempt.count({ where: { userId: a.userId, status: AttemptStatus.DONE } });
      if (n % 20 === 0) await this.redis.enqueue({ type: 'calibrate', id: a.userId }).catch(() => undefined);
    }
    if (!COUNTED.includes(a.context)) return;
    await this.applyDaily(a);
    // 기초선 녹음에는 피드백·진도를 매기지 않는다 (디자인 Baseline: 기준을 그대로 남기려고)
    if (a.soundSymbol && a.context !== AttemptContext.BASELINE && a.context !== AttemptContext.WEEKLY) await this.applySound(a);
    if (a.soundSymbol && (a.context === AttemptContext.BASELINE || a.context === AttemptContext.WEEKLY)) await this.applyBaseline(a);
  }

  private async applyDaily(a: Attempt) {
    const date = seoulDate(a.createdAt);
    const settings = await this.prisma.settings.findUnique({ where: { userId: a.userId } });
    const goal = settings?.dailyGoal ?? 5;
    const day = await this.prisma.dailySession.upsert({
      where: { userId_date: { userId: a.userId, date } },
      create: { userId: a.userId, date, goal },
      update: {},
    });
    const doneItems = await this.doneItemIds(a.userId, date);
    const completedCount = doneItems.size;
    const reached = completedCount >= day.goal && !day.completedAt;
    await this.prisma.dailySession.update({
      where: { id: day.id },
      data: { recordingCount: { increment: 1 }, completedCount, ...(reached ? { completedAt: new Date() } : {}) },
    });
    if (reached) await this.bumpStreak(a.userId, date);
  }

  async doneItemIds(userId: string, date: string) {
    const [start, end] = this.dayRange(date);
    const rows = await this.prisma.attempt.findMany({
      where: { userId, status: AttemptStatus.DONE, context: { in: COUNTED }, createdAt: { gte: start, lt: end }, itemId: { not: null } },
      select: { itemId: true },
      distinct: ['itemId'],
    });
    return new Set(rows.map((r) => r.itemId!));
  }

  dayRange(date: string): [Date, Date] {
    const start = new Date(`${date}T00:00:00+09:00`);
    return [start, new Date(start.getTime() + 86400_000)];
  }

  private async bumpStreak(userId: string, date: string) {
    const s = await this.prisma.streak.upsert({ where: { userId }, create: { userId }, update: {} });
    if (s.lastDate === date) return;
    const current = s.lastDate === addDays(date, -1) ? s.current + 1 : 1;
    await this.prisma.streak.update({ where: { userId }, data: { current, best: Math.max(s.best, current), lastDate: date } });
  }

  /** 기초선 3개 × 3번, 일주일 체크 3개를 다 하면 표시 */
  private async applyBaseline(a: Attempt) {
    const sound = await this.prisma.sound.findUnique({ where: { symbol: a.soundSymbol! } });
    if (!sound) return;
    const words = await this.prisma.lessonItem.findMany({ where: { baselineFor: sound.symbol }, select: { id: true } });
    const ids = words.map((w) => w.id);
    const key = { userId_soundId: { userId: a.userId, soundId: sound.id } };
    await this.prisma.soundProgress.upsert({ where: key, create: { userId: a.userId, soundId: sound.id }, update: {} });
    if (a.context === AttemptContext.BASELINE) {
      const counts = await this.prisma.attempt.groupBy({ by: ['itemId'], where: { userId: a.userId, context: AttemptContext.BASELINE, status: AttemptStatus.DONE, itemId: { in: ids } }, _count: true });
      if (ids.length && ids.every((id) => (counts.find((c) => c.itemId === id)?._count ?? 0) >= 3)) {
        await this.prisma.soundProgress.update({ where: key, data: { baselineDoneAt: new Date() } });
      }
    } else {
      const sp = await this.prisma.soundProgress.findUniqueOrThrow({ where: key });
      const since = sp.weeklyDoneAt ?? sp.baselineDoneAt ?? new Date(0);
      const done = await this.prisma.attempt.findMany({ where: { userId: a.userId, context: AttemptContext.WEEKLY, status: AttemptStatus.DONE, itemId: { in: ids }, createdAt: { gt: since } }, select: { itemId: true }, distinct: ['itemId'] });
      if (ids.length && done.length >= ids.length) await this.prisma.soundProgress.update({ where: key, data: { weeklyDoneAt: new Date() } });
    }
  }

  private async applySound(a: Attempt) {
    const sound = await this.prisma.sound.findUnique({ where: { symbol: a.soundSymbol! } });
    if (!sound) return;
    const verdict = verdictsFromOps((a.result as any)?.phonemes?.ops)[sound.symbol];
    const key = { userId_soundId: { userId: a.userId, soundId: sound.id } };
    const sp = await this.prisma.soundProgress.upsert({ where: key, create: { userId: a.userId, soundId: sound.id }, update: {} });
    const passed = verdict === true;
    const failed = verdict === false;
    const passes = sp.passes + (passed ? 1 : 0);
    let state = sp.state === SoundState.LOCKED ? SoundState.LEARNING : sp.state;
    if (state === SoundState.LEARNING && passes >= LEARNED_MIN_PASSES) {
      const items = await this.prisma.attempt.findMany({
        where: { userId: a.userId, soundSymbol: sound.symbol, status: AttemptStatus.DONE, passed: true },
        select: { itemId: true },
        distinct: ['itemId'],
      });
      // 이번 시도의 passed 는 문항 전체 기준이라, 소리 기준 통과를 따로 셈한다
      const distinct = new Set(items.map((i) => i.itemId));
      if (passed) distinct.add(a.itemId);
      if (distinct.size >= LEARNED_MIN_ITEMS) state = SoundState.LEARNED;
    }
    await this.prisma.soundProgress.update({
      where: key,
      data: {
        attempts: { increment: 1 },
        passes,
        consecutiveFails: failed ? { increment: 1 } : passed ? 0 : undefined,
        lastPracticedAt: new Date(),
        state,
      },
    });
  }

  /** 성장 기록: 첫 진단과 마지막 진단을 같은 목록으로 비교 (PCC·PWC), 이번 주 녹음, 소리별 처음 vs 지금 */
  async summary(userId: string) {
    const today = seoulDate();
    const monday = mondayOf(today);
    const [start] = this.dayRange(monday);
    const weekAttempts = await this.prisma.attempt.findMany({
      where: { userId, createdAt: { gte: start }, status: AttemptStatus.DONE, context: { not: AttemptContext.MIC_CHECK } },
      select: { createdAt: true },
    });
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      return { date: d, count: weekAttempts.filter((x) => seoulDate(x.createdAt) === d).length };
    });
    const [lastMonday] = this.dayRange(addDays(monday, -7));
    const lastWeek = await this.prisma.attempt.count({
      where: { userId, createdAt: { gte: lastMonday, lt: start }, status: AttemptStatus.DONE, context: { not: AttemptContext.MIC_CHECK } },
    });
    const total = await this.prisma.attempt.count({ where: { userId, status: AttemptStatus.DONE, context: { not: AttemptContext.MIC_CHECK } } });

    const sessions = await this.prisma.placementSession.findMany({
      where: { userId, finishedAt: { not: null } },
      orderBy: { finishedAt: 'asc' },
      select: { id: true, finishedAt: true, summary: true },
    });
    const first = sessions[0];
    const last = sessions.length > 1 ? sessions[sessions.length - 1] : null;

    // 소리별 처음 vs 지금 (연습한 소리만)
    const practiced = await this.prisma.soundProgress.findMany({
      where: { userId, attempts: { gt: 0 } },
      include: { sound: true },
      orderBy: { lastPracticedAt: 'desc' },
    });
    const compare = [];
    for (const p of practiced.slice(0, 6)) {
      const where = { userId, soundSymbol: p.sound.symbol, status: AttemptStatus.DONE };
      const [firstA, lastA] = await Promise.all([
        this.prisma.attempt.findFirst({ where, orderBy: { createdAt: 'asc' } }),
        this.prisma.attempt.findFirst({ where, orderBy: { createdAt: 'desc' } }),
      ]);
      const pick = (x: Attempt | null) =>
        x && { id: x.id, target: x.targetText, heard: x.heard, passed: x.passed, at: x.createdAt, hiss: (x.result as any)?.measures?.hiss ?? null };
      compare.push({ symbol: p.sound.symbol, state: p.state, attempts: p.attempts, passes: p.passes, first: pick(firstA), latest: firstA?.id === lastA?.id ? null : pick(lastA) });
    }

    // 모음 삼각형 (ㅣ·ㅏ·ㅜ): 첫 진단 글자 vs 가장 최근 녹음 (VowelSpace · Progress)
    const vowelAttempts = await this.prisma.attempt.findMany({
      where: { userId, status: AttemptStatus.DONE, targetText: { in: ['이', '아', '우'] } },
      orderBy: { createdAt: 'asc' },
      select: { targetText: true, result: true, createdAt: true, context: true },
    });
    const pt = (a: { result: any }) => {
      const f = (a.result as any)?.measures?.formants;
      return f?.f1 && f?.f2 ? [f.f1, f.f2] : null;
    };
    const SYM: Record<string, string> = { 이: 'ㅣ', 아: 'ㅏ', 우: 'ㅜ' };
    const firstPts: Record<string, number[]> = {};
    const lastPts: Record<string, number[]> = {};
    for (const a of vowelAttempts) {
      const p = pt(a);
      if (!p) continue;
      const k = SYM[a.targetText];
      if (!firstPts[k]) firstPts[k] = p;
      lastPts[k] = p;
    }
    const area = (P: Record<string, number[]>) => {
      if (!P['ㅣ'] || !P['ㅏ'] || !P['ㅜ']) return null;
      const [[a1, a2], [b1, b2], [c1, c2]] = [P['ㅣ'], P['ㅏ'], P['ㅜ']];
      return Math.abs(a2 * (b1 - c1) + b2 * (c1 - a1) + c2 * (a1 - b1)) / 2;
    };
    const aFirst = area(firstPts);
    const aLast = area(lastPts);

    // ㅅ 기초선 3회 vs 연습 후 (같은 단어) 바람 중심 높이
    const sWords = await this.prisma.lessonItem.findMany({ where: { baselineFor: 'ㅅ' }, select: { id: true } });
    const hissOf = (rows: { result: any }[]) => rows.map((r) => (r.result as any)?.measures?.hiss?.centroidKHz).filter((v): v is number => typeof v === 'number');
    const sIds = sWords.map((w) => w.id);
    const [sBase, sAfter] = await Promise.all([
      this.prisma.attempt.findMany({ where: { userId, itemId: { in: sIds }, context: AttemptContext.BASELINE, status: AttemptStatus.DONE }, orderBy: { createdAt: 'asc' }, take: 9, select: { result: true } }),
      this.prisma.attempt.findMany({ where: { userId, itemId: { in: sIds }, context: { in: [AttemptContext.WEEKLY, AttemptContext.PRACTICE] }, status: AttemptStatus.DONE }, orderBy: { createdAt: 'desc' }, take: 9, select: { result: true } }),
    ]);
    const firstPlacement = sessions[0]?.finishedAt ?? null;
    const days = firstPlacement ? Math.max(0, Math.round((Date.now() - firstPlacement.getTime()) / 86400_000)) : null;
    const pwcFirst = (first?.summary as any)?.pwc?.correct;
    const pwcLast = (last?.summary as any)?.pwc?.correct;

    return {
      daysSinceFirst: days,
      wordsImproved: pwcFirst !== undefined && pwcLast !== undefined ? pwcLast - pwcFirst : null,
      vowels: { first: firstPts, latest: lastPts, areaFirst: aFirst, areaLatest: aLast, areaIndex: aFirst && aLast ? Math.round((aLast / aFirst) * 100) : null },
      hissS: { baseline: hissOf(sBase), after: hissOf(sAfter) },
      totalRecordings: total,
      week,
      thisWeek: weekAttempts.length,
      lastWeek,
      placement: { first: first ? this.metrics(first) : null, latest: last ? this.metrics(last) : null, sessions: sessions.length },
      sounds: compare,
    };
  }

  private metrics(s: { id: string; finishedAt: Date | null; summary: any }) {
    return { id: s.id, at: s.finishedAt, pcc: s.summary?.pcc ?? null, pwc: s.summary?.pwc ?? null };
  }
}
