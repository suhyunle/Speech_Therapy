import { Controller, Get, Injectable, Module, NotFoundException, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttemptContext, AttemptStatus, ItemKind, SoundState } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { seoulDate } from '../../common/util';
import { ProgressModule } from '../progress/progress.module';
import { ProgressService } from '../progress/progress.service';

const WEEK_MS = 7 * 86400_000;
const BASELINE_REPEAT = 3;
const EXERCISE_ORDER = ['forward', 'endclear', 'intonation', 'timing'] as const;

/**
 * 복습(Review) · 기초선(Baseline) · 일주일 체크(WeeklyCheck) · 발성 연습(WebVoice)
 */
@Injectable()
export class TrainingService {
  constructor(private prisma: PrismaService, private progress: ProgressService) {}

  /** 복습 3개: 배웠거나 이미 좋은 소리 중 오래 안 본 것부터, 단어 하나씩 */
  async review(userId: string) {
    const sp = await this.prisma.soundProgress.findMany({
      where: { userId, state: { in: [SoundState.LEARNED, SoundState.ALREADY_GOOD] } },
      include: { sound: true },
      orderBy: [{ lastPracticedAt: { sort: 'asc', nulls: 'first' } }],
      take: 3,
    });
    const date = seoulDate();
    const doneIds = await this.progress.doneItemIds(userId, date);
    const out = [];
    for (const p of sp) {
      const words = await this.prisma.lessonItem.findMany({ where: { kind: ItemKind.WORD, targetSounds: { has: p.sound.symbol }, exercise: null }, orderBy: { text: 'asc' }, take: 6 });
      if (!words.length) continue;
      const w = words[(new Date(date).getDate() + p.sound.orderIndex) % words.length];
      const g = p.sound.guide as any;
      out.push({
        symbol: p.sound.symbol,
        state: p.state,
        manner: g?.manner ?? p.sound.manner,
        lastAt: p.lastPracticedAt ?? p.updatedAt,
        tip: g?.steps?.[g.steps.length - 1] ?? null,
        item: { id: w.id, text: w.text, note: w.note },
        done: doneIds.has(w.id),
      });
    }
    return out;
  }

  /** 새 소리 시작 전 기초선: 단어 3개 × 3번. 피드백은 보여주지 않는다. */
  async baseline(userId: string, symbol: string) {
    const sound = await this.prisma.sound.findUnique({ where: { symbol } });
    if (!sound) throw new NotFoundException('없는 소리예요');
    const words = await this.prisma.lessonItem.findMany({ where: { baselineFor: symbol }, orderBy: { text: 'asc' }, select: { id: true, text: true, note: true } });
    const counts = await this.prisma.attempt.groupBy({
      by: ['itemId'],
      where: { userId, context: AttemptContext.BASELINE, status: AttemptStatus.DONE, itemId: { in: words.map((w) => w.id) } },
      _count: true,
    });
    const sp = await this.prisma.soundProgress.findUnique({ where: { userId_soundId: { userId, soundId: sound.id } } });
    const items = words.map((w) => ({ ...w, count: Math.min(BASELINE_REPEAT, counts.find((c) => c.itemId === w.id)?._count ?? 0) }));
    return { symbol, repeat: BASELINE_REPEAT, items, done: !!sp?.baselineDoneAt, doneAt: sp?.baselineDoneAt ?? null, next: items.find((i) => i.count < BASELINE_REPEAT) ?? null };
  }

  /** 일주일 체크: 기초선과 같은 단어로만 비교 (들린 대로 기준) */
  async weekly(userId: string, symbol: string) {
    const sound = await this.prisma.sound.findUnique({ where: { symbol } });
    if (!sound) throw new NotFoundException('없는 소리예요');
    const sp = await this.prisma.soundProgress.findUnique({ where: { userId_soundId: { userId, soundId: sound.id } } });
    const words = await this.prisma.lessonItem.findMany({ where: { baselineFor: symbol }, orderBy: { text: 'asc' } });
    const since = sp?.weeklyDoneAt ?? sp?.baselineDoneAt ?? null;
    const due = !!sp?.baselineDoneAt && Date.now() - (sp.weeklyDoneAt ?? sp.baselineDoneAt).getTime() >= WEEK_MS;
    const rows = [];
    for (const w of words) {
      const base = await this.prisma.attempt.findMany({ where: { userId, itemId: w.id, context: AttemptContext.BASELINE, status: AttemptStatus.DONE }, orderBy: { createdAt: 'asc' }, take: BASELINE_REPEAT });
      const now = await this.prisma.attempt.findFirst({ where: { userId, itemId: w.id, context: AttemptContext.WEEKLY, status: AttemptStatus.DONE }, orderBy: { createdAt: 'desc' } });
      const score = (a: { result: any } | null) => (a?.result as any)?.phonemes?.matched ?? null;
      const baseBest = base.length ? Math.max(...base.map((b) => score(b) ?? 0)) : null;
      const total = (base[0]?.result as any)?.phonemes?.total ?? null;
      const nowScore = score(now);
      rows.push({
        itemId: w.id,
        text: w.text,
        baselineHeard: base[base.length - 1]?.heard ?? null,
        nowHeard: now?.heard ?? null,
        baselineMatched: baseBest,
        nowMatched: nowScore,
        total,
        // 체크할 때가 되면 지난 체크 뒤의 녹음만, 방금 끝냈으면 그 녹음을 보여준다
        recordedNow: !!now && (!due || !since || now.createdAt > since),
        verdict: nowScore === null || baseBest === null ? null : nowScore > baseBest ? 'better' : nowScore < baseBest ? 'worse' : 'same',
      });
    }
    return { symbol, due, baselineDoneAt: sp?.baselineDoneAt ?? null, weeklyDoneAt: sp?.weeklyDoneAt ?? null, rows, improved: rows.filter((r) => r.verdict === 'better').length };
  }

  /** 지금 일주일 체크를 할 소리들 */
  async weeklyDue(userId: string) {
    const sp = await this.prisma.soundProgress.findMany({ where: { userId, baselineDoneAt: { not: null } }, include: { sound: true } });
    return sp
      .filter((p) => Date.now() - (p.weeklyDoneAt ?? p.baselineDoneAt!).getTime() >= WEEK_MS)
      .map((p) => ({ symbol: p.sound.symbol, since: p.weeklyDoneAt ?? p.baselineDoneAt }));
  }

  /** 발성 연습 문항 + 가장 최근 결과 (WebVoice · VoiceForward · EndClear · Intonation · Timing) */
  async exercises(userId: string) {
    const items = await this.prisma.lessonItem.findMany({ where: { exercise: { not: null } }, orderBy: { createdAt: 'asc' } });
    const out: Record<string, any[]> = {};
    for (const kind of [...EXERCISE_ORDER, 'hiss']) {
      out[kind] = [];
      for (const it of items.filter((i) => i.exercise === kind)) {
        const last = await this.prisma.attempt.findMany({ where: { userId, itemId: it.id, status: AttemptStatus.DONE }, orderBy: { createdAt: 'desc' }, take: 2, select: { id: true, heard: true, result: true, createdAt: true } });
        out[kind].push({ id: it.id, text: it.text, pronunciation: it.pronunciation, note: it.note, intonation: it.intonation, last: last[0] ?? null, previous: last[1] ?? null });
      }
    }
    return out;
  }
}

@ApiTags('training')
@ApiBearerAuth()
@Controller()
export class TrainingController {
  constructor(private t: TrainingService) {}
  @Get('review') review(@CurrentUser() u: AuthUser) {
    return this.t.review(u.id);
  }
  @Get('baseline/:symbol') baseline(@CurrentUser() u: AuthUser, @Param('symbol') s: string) {
    return this.t.baseline(u.id, s);
  }
  @Get('weekly') weeklyDue(@CurrentUser() u: AuthUser) {
    return this.t.weeklyDue(u.id);
  }
  @Get('weekly/:symbol') weekly(@CurrentUser() u: AuthUser, @Param('symbol') s: string) {
    return this.t.weekly(u.id, s);
  }
  @Get('exercises') exercises(@CurrentUser() u: AuthUser) {
    return this.t.exercises(u.id);
  }
}

@Module({ imports: [ProgressModule], controllers: [TrainingController], providers: [TrainingService], exports: [TrainingService] })
export class TrainingModule {}
