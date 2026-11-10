import { Controller, Get, Injectable, Module, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttemptStatus, ItemKind, SoundState } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { OpLike, verdictsFromOps } from '../progress/progress.service';

const STAGES = [ItemKind.SYLLABLE, ItemKind.WORD, ItemKind.SENTENCE] as const;
const STAGE_KEY: Record<string, 'syllable' | 'word' | 'sentence'> = { SYLLABLE: 'syllable', WORD: 'word', SENTENCE: 'sentence' };
const VOWELS = new Set('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ');

type StageVerdicts = { syllable: boolean | null; word: boolean | null; sentence: boolean | null };

/**
 * 첫 진단 판정 규칙 (PlacementResult: "글자·단어·문장 모두 통과"):
 * 소리가 나온 단계가 2개 이상이고, 나온 단계에서 모두 통과하면 '이미 발음이 좋아요'.
 * 한 단계에서만 나온 소리는 근거가 부족해서 클리어하지 않는다.
 */
export function decide(perSound: Record<string, StageVerdicts>) {
  const cleared: string[] = [];
  const practice: string[] = [];
  const unknown: string[] = [];
  for (const [s, v] of Object.entries(perSound)) {
    const known = Object.values(v).filter((x) => x !== null) as boolean[];
    if (known.length === 0) unknown.push(s);
    else if (known.every(Boolean) && known.length >= 2) cleared.push(s);
    else if (known.some((x) => x === false)) practice.push(s);
    else unknown.push(s); // 한 단계만 통과 → 판단 보류
  }
  return { cleared, practice, unknown };
}

/** 자음정확도(PCC)·낱말 정확도(PWC) — 단어 단계만으로 계산 */
export function wordMetrics(wordOps: OpLike[][]) {
  let cTotal = 0;
  let cOk = 0;
  let wOk = 0;
  let wTotal = 0;
  for (const ops of wordOps) {
    if (ops.some((o) => o.type === 'unsure')) continue;
    wTotal++;
    let allOk = true;
    for (const o of ops) {
      if (o.type === 'ins') {
        allOk = false;
        continue;
      }
      if (!o.target) continue;
      const ok = o.type === 'same' || o.type === 'allowed';
      if (!ok) allOk = false;
      if (!VOWELS.has(o.target.symbol)) {
        cTotal++;
        if (ok) cOk++;
      }
    }
    if (allOk) wOk++;
  }
  return { pcc: cTotal ? { correct: cOk, total: cTotal } : null, pwc: wTotal ? { correct: wOk, total: wTotal } : null };
}

@Injectable()
export class PlacementService {
  constructor(private prisma: PrismaService) {}

  async start(userId: string) {
    const session = await this.prisma.placementSession.create({ data: { userId } });
    const items = await this.prisma.lessonItem.findMany({
      where: { placement: true },
      orderBy: [{ placementOrder: 'asc' }],
      select: { id: true, kind: true, text: true, pronunciation: true, note: true, targetSounds: true },
    });
    return { session, stages: STAGES.map((k) => ({ kind: k, items: items.filter((i) => i.kind === k) })) };
  }

  private async own(userId: string, id: string) {
    const s = await this.prisma.placementSession.findFirst({ where: { id, userId } });
    if (!s) throw new NotFoundException('진단을 찾을 수 없어요');
    return s;
  }

  async get(userId: string, id: string) {
    const s = await this.own(userId, id);
    const attempts = await this.prisma.attempt.findMany({
      where: { placementSessionId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, itemId: true, status: true, heard: true, passed: true, issue: true },
    });
    return { ...s, attempts };
  }

  async finish(userId: string, id: string) {
    await this.own(userId, id);
    const attempts = await this.prisma.attempt.findMany({
      where: { placementSessionId: id, status: AttemptStatus.DONE },
      orderBy: { createdAt: 'asc' },
      include: { item: true },
    });
    // 문항마다 마지막 시도만 본다
    const latest = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) if (a.itemId) latest.set(a.itemId, a);

    const sounds = await this.prisma.sound.findMany();
    const perSound: Record<string, StageVerdicts> = {};
    for (const s of sounds) perSound[s.symbol] = { syllable: null, word: null, sentence: null };

    const wordOps: OpLike[][] = [];
    // 단계별 · 맞게 낸 개수 (WebPlacementResult): 소리가 모두 맞은 문항 수 / 진단 문항 수
    const totals = await this.prisma.lessonItem.groupBy({ by: ['kind'], where: { placement: true }, _count: true });
    const stageCounts: Record<string, { ok: number; total: number }> = {};
    for (const t of totals) if (STAGE_KEY[t.kind]) stageCounts[STAGE_KEY[t.kind]] = { ok: 0, total: t._count };
    for (const a of latest.values()) {
      const stage = STAGE_KEY[a.item!.kind];
      if (!stage) continue;
      const ops = (a.result as any)?.phonemes?.ops as OpLike[] | undefined;
      if (ops?.length && ops.every((o) => !o.target || o.type === 'same' || o.type === 'allowed') && !ops.some((o) => o.type === 'ins')) stageCounts[stage].ok++;
      if (a.item!.kind === ItemKind.WORD && ops) wordOps.push(ops);
      for (const [sym, v] of Object.entries(verdictsFromOps(ops))) {
        if (!(sym in perSound) || v === null) continue;
        const cur = perSound[sym][stage];
        perSound[sym][stage] = cur === false ? false : v;
      }
    }
    const tested = Object.fromEntries(Object.entries(perSound).filter(([, v]) => Object.values(v).some((x) => x !== null)));
    const decision = decide(tested);
    const metrics = wordMetrics(wordOps);
    const summary = { ...decision, perSound: tested, ...metrics, answered: latest.size, stageCounts };

    await this.prisma.$transaction([
      this.prisma.placementSession.update({ where: { id }, data: { finishedAt: new Date(), summary } }),
      ...sounds.map((s) => {
        const ps = perSound[s.symbol];
        const already = decision.cleared.includes(s.symbol);
        return this.prisma.soundProgress.upsert({
          where: { userId_soundId: { userId, soundId: s.id } },
          create: { userId, soundId: s.id, state: already ? SoundState.ALREADY_GOOD : SoundState.LOCKED, placementResult: ps },
          // 이미 배운 소리는 되돌리지 않는다
          update: { placementResult: ps, ...(already ? { state: SoundState.ALREADY_GOOD } : {}) },
        });
      }),
    ]);
    return summary;
  }

  async latest(userId: string) {
    return this.prisma.placementSession.findFirst({ where: { userId, finishedAt: { not: null } }, orderBy: { finishedAt: 'desc' } });
  }
}

@ApiTags('placement')
@ApiBearerAuth()
@Controller('placement')
export class PlacementController {
  constructor(private placement: PlacementService) {}
  @Post() start(@CurrentUser() u: AuthUser) {
    return this.placement.start(u.id);
  }
  @Get('latest') latest(@CurrentUser() u: AuthUser) {
    return this.placement.latest(u.id);
  }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.placement.get(u.id, id);
  }
  @Post(':id/finish') finish(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.placement.finish(u.id, id);
  }
}

@Module({ controllers: [PlacementController], providers: [PlacementService] })
export class PlacementModule {}
