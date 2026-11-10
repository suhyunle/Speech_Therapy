import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ItemKind, SoundState } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/auth';
import { soundsIn } from '../../common/hangul';
import { PrismaService } from '../../common/prisma.service';
import { addDays, mondayOf, seoulDate } from '../../common/util';
import { GROUP_LABEL, GROUP_ORDER } from '../content/content.module';
import { ProgressModule } from '../progress/progress.module';
import { ProgressService } from '../progress/progress.service';

/** 하루 목표별 구성 (GoalSetup): 3 = 단어 3 · 5 = 단어 4 + 문장 1 · 10 = 단어 7 + 문장 3 */
export const GOAL_MIX: Record<number, { words: number; sentences: number }> = {
  3: { words: 3, sentences: 0 },
  5: { words: 4, sentences: 1 },
  10: { words: 7, sentences: 3 },
};

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** 날마다 다른 단어가 나오게 돌린다 (같은 단어만 외우지 않게). 기초선 단어는 매일 1개 포함. */
export function rotate<T extends { id: string; baselineFor?: string | null }>(items: T[], n: number, date: string): T[] {
  if (items.length <= n) return items;
  const fixed = items.filter((i) => i.baselineFor);
  const rest = items.filter((i) => !i.baselineFor);
  const out: T[] = [];
  if (fixed.length) out.push(fixed[hash(date) % fixed.length]);
  const start = hash(date + 'x') % Math.max(rest.length, 1);
  for (let k = 0; out.length < n && k < rest.length; k++) out.push(rest[(start + k) % rest.length]);
  for (let k = 0; out.length < n && k < fixed.length; k++) if (!out.includes(fixed[k])) out.push(fixed[k]);
  return out;
}

@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService, private progress: ProgressService) {}

  async today(userId: string) {
    const date = seoulDate();
    const [settings, sounds, progress, streak, user] = await Promise.all([
      this.prisma.settings.upsert({ where: { userId }, create: { userId }, update: {} }),
      this.prisma.sound.findMany({ orderBy: { orderIndex: 'asc' } }),
      this.prisma.soundProgress.findMany({ where: { userId } }),
      this.prisma.streak.findUnique({ where: { userId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, isGuest: true, baseline: true } }),
    ]);
    const stateOf = new Map(progress.map((p) => [p.soundId, p]));
    const path = sounds.map((s) => ({
      symbol: s.symbol,
      kind: s.kind,
      group: s.groupKey,
      state: stateOf.get(s.id)?.state ?? SoundState.LOCKED,
      consecutiveFails: stateOf.get(s.id)?.consecutiveFails ?? 0,
    }));
    const done = (st: SoundState) => st === SoundState.ALREADY_GOOD || st === SoundState.LEARNED;
    const current = path.find((p) => p.state === SoundState.LEARNING) ?? path.find((p) => !done(p.state)) ?? null;

    const groups: { key: string; label: string; done: boolean; current: boolean }[] = GROUP_ORDER.map((g) => {
      const inGroup = path.filter((p) => p.group === g);
      return { key: g, label: GROUP_LABEL[g], done: inGroup.length > 0 && inGroup.every((p) => done(p.state)), current: current?.group === g };
    });
    // 5단계 억양 · 길이: 소리를 모두 배운 뒤 (디자인 LearnOrder)
    groups.push({ key: 'prosody', label: '억양', done: false, current: !current });

    const goal = settings.dailyGoal;
    const mix = GOAL_MIX[goal] ?? GOAL_MIX[5];
    let items: { id: string; kind: ItemKind; text: string; note: string | null; done: boolean }[] = [];
    if (current) {
      // 이 소리를 '보는 소리'로 지정한 문항 먼저, 모자라면 발음 안에 이 소리가 든 문항으로 채운다
      const all = await this.prisma.lessonItem.findMany({
        where: { kind: { in: [ItemKind.WORD, ItemKind.SENTENCE] }, exercise: null },
        orderBy: [{ difficulty: 'asc' }, { text: 'asc' }],
        select: { id: true, kind: true, text: true, note: true, baselineFor: true, targetSounds: true, pronunciation: true },
      });
      const sym = current.symbol;
      const primary = all.filter((i) => i.targetSounds.includes(sym));
      const secondary = all.filter((i) => !i.targetSounds.includes(sym) && soundsIn(i.pronunciation).has(sym));
      const pick = (kind: ItemKind, n: number) => {
        const p = rotate(primary.filter((i) => i.kind === kind), n, date);
        return p.length >= n ? p : [...p, ...rotate(secondary.filter((i) => i.kind === kind).map((i) => ({ ...i, baselineFor: null })), n - p.length, date)];
      };
      const pool = { pick };
      const sentences = pool.pick(ItemKind.SENTENCE, mix.sentences);
      // 이 소리가 든 문장이 모자라면 단어로 채운다
      const words = pool.pick(ItemKind.WORD, mix.words + (mix.sentences - sentences.length));
      const doneIds = await this.progress.doneItemIds(userId, date);
      items = [...words, ...sentences].map(({ id, kind, text, note }) => ({ id, kind, text, note, done: doneIds.has(id) }));
    }

    const monday = mondayOf(date);
    const days = await this.prisma.dailySession.findMany({ where: { userId, date: { gte: monday, lte: addDays(monday, 6) } } });
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      const row = days.find((x) => x.date === d);
      return { date: d, isToday: d === date, completed: !!row?.completedAt, recordings: row?.recordingCount ?? 0 };
    });
    const todayRow = days.find((x) => x.date === date);
    const thisWeek = week.reduce((a, b) => a + b.recordings, 0);
    const streakAlive = streak?.lastDate === date || streak?.lastDate === addDays(date, -1);

    // 발성 1분 준비 (GoalSetup: '발성 1분 + 단어') · 오늘 했는지
    const [start] = this.progress.dayRange(date);
    const warmItem = await this.prisma.lessonItem.findFirst({ where: { exercise: 'forward' }, orderBy: { createdAt: 'asc' } });
    const warmDone = warmItem ? (await this.prisma.attempt.count({ where: { userId, itemId: warmItem.id, status: 'DONE', createdAt: { gte: start } } })) > 0 : false;
    const curProgress = current ? progress.find((p) => sounds.find((s) => s.id === p.soundId)?.symbol === current.symbol) : undefined;
    const weeklyDue = progress
      .filter((p) => p.baselineDoneAt && Date.now() - (p.weeklyDoneAt ?? p.baselineDoneAt).getTime() >= 7 * 86400_000)
      .map((p) => sounds.find((s) => s.id === p.soundId)!.symbol);
    const lastDay = streak?.lastDate ?? null;
    const daysAway = lastDay ? Math.round((new Date(date).getTime() - new Date(lastDay).getTime()) / 86400_000) : null;

    return {
      date,
      warmup: warmItem ? { id: warmItem.id, text: warmItem.text, done: warmDone } : null,
      baselineNeeded: !!current && !curProgress?.baselineDoneAt && (curProgress?.attempts ?? 0) === 0,
      weeklyDue,
      daysAway,
      learnedCount: path.filter((p) => p.state === SoundState.LEARNED).length,
      name: user.name,
      isGuest: user.isGuest,
      hasBaseline: !!user.baseline,
      // 모음 점의 기준 평균(성인 여/남 대략값): 처음 기준 목소리 높이로 고른다 (분석기 audio.vowel_set 과 같은 규칙)
      vowelSet: ((user.baseline as any)?.pitchHz && (user.baseline as any).pitchHz < 165 ? 'm' : 'f') as 'f' | 'm',
      goal,
      completed: items.filter((i) => i.done).length,
      todayRecordings: todayRow?.recordingCount ?? 0,
      thisWeekRecordings: thisWeek,
      streak: { current: streakAlive ? streak?.current ?? 0 : 0, best: streak?.best ?? 0, broken: !streakAlive && (streak?.current ?? 0) > 0 },
      clearedCount: path.filter((p) => done(p.state)).length,
      groups,
      current,
      path,
      items,
      week,
    };
  }
}

@ApiTags('plan')
@ApiBearerAuth()
@Controller('plan')
export class PlanController {
  constructor(private plan: PlanService) {}
  @Get('today') today(@CurrentUser() u: AuthUser) {
    return this.plan.today(u.id);
  }
}

@Module({ imports: [ProgressModule], controllers: [PlanController], providers: [PlanService] })
export class PlanModule {}
