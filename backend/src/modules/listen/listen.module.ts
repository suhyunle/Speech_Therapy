import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  GoneException,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { AttemptStatus, Familiarity, ListenerGroup } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { randomBytes, randomUUID } from 'crypto';
import type { Response } from 'express';
import { AuthUser, CurrentUser, Public } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { StorageService } from '../../common/storage.service';

const LINK_DAYS = 7;

export class CreateLinkDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsUUID('all', { each: true }) attemptIds: string[];
  @ApiProperty({ enum: ListenerGroup }) @IsEnum(ListenerGroup) group: ListenerGroup;
}

export class AnswerDto {
  @ApiProperty() @IsString() @MaxLength(40) listenerKey: string;
  @ApiProperty() @IsInt() @Min(1) order: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) answerText?: string;
  @ApiProperty() @IsBoolean() unsure: boolean;
  @ApiProperty({ enum: Familiarity }) @IsEnum(Familiarity) familiarity: Familiarity;
}

@Injectable()
export class ListenService {
  constructor(private prisma: PrismaService, private storage: StorageService, private redis: RedisService) {}

  async create(userId: string, dto: CreateLinkDto) {
    const attempts = await this.prisma.attempt.findMany({
      where: { id: { in: dto.attemptIds }, userId, status: AttemptStatus.DONE, recording: { deletedAt: null } },
      select: { id: true },
    });
    if (attempts.length !== dto.attemptIds.length) throw new BadRequestException('들려줄 수 없는 녹음이 있어요');
    // 순서는 무작위로 섞는다 (앞 문제가 뒤를 짐작하게 하지 않게)
    const shuffled = [...dto.attemptIds].sort(() => Math.random() - 0.5);
    return this.prisma.listenLink.create({
      data: {
        userId,
        code: randomBytes(12).toString('base64url'),
        group: dto.group,
        expiresAt: new Date(Date.now() + LINK_DAYS * 86400_000),
        items: { create: shuffled.map((attemptId, i) => ({ attemptId, order: i + 1 })) },
      },
      include: { items: true },
    });
  }

  async mine(userId: string) {
    const links = await this.prisma.listenLink.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: { attempt: { select: { targetText: true, heard: true, result: true } }, answers: { orderBy: { createdAt: 'asc' } } },
        },
      },
    });
    const same = (a: string | null, b: string | null) => !!a && !!b && a.replace(/[\s.?!,]/g, '') === b.replace(/[\s.?!,]/g, '');
    return links.map((l) => ({
      // 사람 귀 vs 앱: 문항마다 사람이 적은 것(가장 많이 나온 답)과 앱이 들은 것이 같은지 (ListenerResult)
      agreement: (() => {
        const done = l.items.filter((i) => i.answers.length);
        const agree = done.filter((i) => i.answers.some((a) => same(a.answerText, i.attempt.heard))).length;
        return { agree, total: done.length };
      })(),
      byListener: Object.values(
        l.items.flatMap((i) => i.answers.map((a) => ({ key: a.listenerKey, fam: a.familiarity, ok: same(a.answerText, i.attempt.targetText) }))).reduce<Record<string, { familiarity: string; understood: number; total: number }>>((acc, x) => {
          acc[x.key] ??= { familiarity: x.fam, understood: 0, total: 0 };
          acc[x.key].total++;
          if (x.ok) acc[x.key].understood++;
          return acc;
        }, {}),
      ),
      id: l.id,
      code: l.code,
      group: l.group,
      createdAt: l.createdAt,
      expiresAt: l.expiresAt,
      active: !l.revokedAt && l.expiresAt > new Date(),
      listeners: new Set(l.items.flatMap((i) => i.answers.map((a) => a.listenerKey))).size,
      items: l.items.map((i) => ({
        order: i.order,
        target: i.attempt.targetText,
        app: { heard: i.attempt.heard, matched: (i.attempt.result as any)?.phonemes?.matched ?? null, total: (i.attempt.result as any)?.phonemes?.total ?? null },
        answers: i.answers.map((a) => ({
          text: a.answerText,
          unsure: a.unsure,
          familiarity: a.familiarity,
          matched: (a.result as any)?.phonemes?.matched ?? null,
          total: (a.result as any)?.phonemes?.total ?? null,
          ops: (a.result as any)?.phonemes?.ops ?? null,
        })),
      })),
    }));
  }

  async revoke(userId: string, id: string) {
    const r = await this.prisma.listenLink.updateMany({ where: { id, userId }, data: { revokedAt: new Date() } });
    if (!r.count) throw new NotFoundException();
    return { ok: true };
  }

  private async active(code: string) {
    const link = await this.prisma.listenLink.findUnique({ where: { code }, include: { items: { orderBy: { order: 'asc' }, include: { attempt: { include: { recording: true } } } } } });
    if (!link) throw new NotFoundException('링크를 찾을 수 없어요');
    if (link.revokedAt || link.expiresAt < new Date()) throw new GoneException('이 링크는 사라졌어요');
    return link;
  }

  /** 듣는 사람 화면: 정답 글자는 주지 않는다 */
  async publicInfo(code: string) {
    const link = await this.active(code);
    return {
      count: link.items.length,
      expiresAt: link.expiresAt,
      listenerKey: randomUUID(),
      items: link.items.map((i) => ({ order: i.order, durationMs: i.attempt.recording?.durationMs ?? null })),
    };
  }

  async publicAudio(code: string, order: number) {
    const link = await this.active(code);
    const item = link.items.find((i) => i.order === order);
    const rec = item?.attempt.recording;
    if (!rec || rec.deletedAt) throw new GoneException('녹음이 지워졌어요');
    return this.storage.get(rec.storageKey);
  }

  async answer(code: string, dto: AnswerDto) {
    const link = await this.active(code);
    const item = link.items.find((i) => i.order === dto.order);
    if (!item) throw new NotFoundException();
    if (!dto.unsure && !dto.answerText?.trim()) throw new BadRequestException('들린 대로 적거나 “잘 모르겠어요”를 눌러주세요');
    const dup = await this.prisma.listenAnswer.findFirst({ where: { linkItemId: item.id, listenerKey: dto.listenerKey } });
    if (dup) throw new BadRequestException('이미 답했어요');
    const a = await this.prisma.listenAnswer.create({
      data: { linkItemId: item.id, listenerKey: dto.listenerKey, answerText: dto.answerText?.trim() || null, unsure: dto.unsure, familiarity: dto.familiarity },
    });
    await this.redis.enqueue({ type: 'listen_answer', id: a.id });
    return { ok: true, remaining: link.items.length - dto.order };
  }

  /** 다 끝낸 듣는 사람에게만 정답 공개 */
  async reveal(code: string, listenerKey: string) {
    const link = await this.active(code);
    const answers = await this.prisma.listenAnswer.findMany({ where: { listenerKey, linkItem: { linkId: link.id } }, include: { linkItem: true } });
    if (answers.length < link.items.length) throw new BadRequestException('모두 받아쓴 뒤에 정답을 볼 수 있어요');
    return link.items.map((i) => ({ order: i.order, target: i.attempt.targetText, yours: answers.find((a) => a.linkItemId === i.id)?.answerText ?? null }));
  }
}

@ApiTags('listen')
@Controller()
export class ListenController {
  constructor(private listen: ListenService) {}

  @ApiBearerAuth() @Post('listen-links') create(@CurrentUser() u: AuthUser, @Body() dto: CreateLinkDto) {
    return this.listen.create(u.id, dto);
  }
  @ApiBearerAuth() @Get('listen-links') mine(@CurrentUser() u: AuthUser) {
    return this.listen.mine(u.id);
  }
  @ApiBearerAuth() @Delete('listen-links/:id') revoke(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.listen.revoke(u.id, id);
  }

  @Public() @Get('l/:code') info(@Param('code') code: string) {
    return this.listen.publicInfo(code);
  }
  @Public()
  @Get('l/:code/items/:order/audio')
  async audio(@Param('code') code: string, @Param('order', ParseIntPipe) order: number, @Res() res: Response) {
    const buf = await this.listen.publicAudio(code, order);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.send(buf);
  }
  @Public() @Throttle({ default: { limit: 30, ttl: 60_000 } }) @Post('l/:code/answers') answer(@Param('code') code: string, @Body() dto: AnswerDto) {
    return this.listen.answer(code, dto);
  }
  @Public() @Get('l/:code/reveal') reveal(@Param('code') code: string, @Query('listenerKey') key: string) {
    return this.listen.reveal(code, String(key ?? ''));
  }
}

@Module({ controllers: [ListenController], providers: [ListenService] })
export class ListenModule {}
