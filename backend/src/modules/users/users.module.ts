import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, Patch, Post, Query, Res } from '@nestjs/common';
import archiver = require('archiver');
import type { Response } from 'express';
import { RedisService } from '../../common/redis.service';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ConsentType, FontSize, Prisma } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { StorageService } from '../../common/storage.service';
import { CONSENT_VERSION } from '../auth/auth.service';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ enum: [3, 5, 10] }) @IsOptional() @IsIn([3, 5, 10]) dailyGoal?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() reminderEnabled?: boolean;
  @ApiPropertyOptional({ example: '20:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: '알림 시간 형식이 맞지 않아요' })
  reminderTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() visualAlert?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() haptics?: boolean;
  @ApiPropertyOptional({ enum: FontSize }) @IsOptional() @IsEnum(FontSize) fontSize?: FontSize;
  @ApiPropertyOptional({ description: '녹음 원본 보관 기간(일) · 0 = 내가 지울 때까지', enum: [0, 30, 90, 365] }) @IsOptional() @IsIn([0, 30, 90, 365]) retentionDays?: number;
  @ApiPropertyOptional({ description: '연구 모드 (기초선 녹음 · 연습 일기 켜기)' }) @IsOptional() @IsBoolean() researchMode?: boolean;
  @ApiPropertyOptional({ description: '내보낼 때 녹음 원본 포함' }) @IsOptional() @IsBoolean() researchAudio?: boolean;
  @ApiPropertyOptional({ description: '연구 심의 번호 (있으면)' }) @IsOptional() @IsString() @MaxLength(60) irbNumber?: string;
  @ApiPropertyOptional({ description: '시작 준비를 마쳤는지' }) @IsOptional() @IsBoolean() onboarded?: boolean;
}

export class VoiceModelDto {
  @ApiProperty() @IsBoolean() enabled: boolean;
}

const csvCell = (v: unknown) => {
  const t = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
export const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '\uFEFF';
  const cols = Object.keys(rows[0]);
  return '\uFEFF' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
};

export class ConsentDto {
  @ApiProperty({ enum: [ConsentType.VOICE_RECORDING, ConsentType.MODEL_TRAINING, ConsentType.RESEARCH] })
  @IsIn([ConsentType.VOICE_RECORDING, ConsentType.MODEL_TRAINING, ConsentType.RESEARCH])
  type: ConsentType;
  @ApiProperty() @IsBoolean() granted: boolean;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private storage: StorageService, private redis: RedisService) {}

  settings(userId: string) {
    return this.prisma.settings.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const { onboarded, ...rest } = dto;
    if (dto.retentionDays !== undefined) {
      // 보관 기간을 바꾸면 지금 있는 녹음의 만료일도 다시 계산한다
      const recs = await this.prisma.recording.findMany({ where: { userId, deletedAt: null }, select: { id: true, createdAt: true } });
      for (const r of recs) {
        const exp = dto.retentionDays > 0 ? new Date(r.createdAt.getTime() + dto.retentionDays * 86400_000) : new Date('9999-12-31T00:00:00Z');
        await this.prisma.recording.update({ where: { id: r.id }, data: { expiresAt: exp } });
      }
    }
    return this.prisma.settings.upsert({
      where: { userId },
      create: { userId, ...rest, onboardedAt: onboarded ? new Date() : null },
      update: { ...rest, ...(onboarded !== undefined ? { onboardedAt: onboarded ? new Date() : null } : {}) },
    });
  }

  /** 동의 이력은 지우지 않고 쌓는다. 가장 최근 기록이 현재 상태. */
  async consents(userId: string) {
    const rows = await this.prisma.consent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const latest: Record<string, { granted: boolean; at: Date; version: string }> = {};
    for (const r of rows) if (!latest[r.type]) latest[r.type] = { granted: r.granted, at: r.createdAt, version: r.version };
    return latest;
  }

  addConsent(userId: string, dto: ConsentDto) {
    return this.prisma.consent.create({ data: { userId, type: dto.type, granted: dto.granted, version: CONSENT_VERSION } });
  }

  async hasConsent(userId: string, type: ConsentType) {
    const r = await this.prisma.consent.findFirst({ where: { userId, type }, orderBy: { createdAt: 'desc' } });
    return !!r?.granted;
  }

  /** 내 녹음 전부 지우기: 원본 파일 삭제, 분석 글자·측정값은 남긴다 (TechSpec 6장) */
  async deleteRecordings(userId: string) {
    await this.storage.removeUser(userId);
    const r = await this.prisma.recording.updateMany({ where: { userId, deletedAt: null }, data: { deletedAt: new Date() } });
    return { deleted: r.count };
  }

  /** 내 목소리에 맞추기 상태 */
  async voiceModel(userId: string) {
    const [settings, user, recordings] = await Promise.all([
      this.settings(userId),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { calibration: true } }),
      this.prisma.attempt.count({ where: { userId, status: 'DONE', context: { not: 'MIC_CHECK' } } }),
    ]);
    return { enabled: settings.personalModel, recordings, goal: 300, retentionDays: settings.retentionDays, calibration: user.calibration };
  }

  /** 켜면 동의를 기록하고 개인 기준을 계산, 끄면 개인 기준을 바로 지운다 */
  async setVoiceModel(userId: string, enabled: boolean) {
    await this.prisma.consent.create({ data: { userId, type: ConsentType.MODEL_TRAINING, granted: enabled, version: CONSENT_VERSION } });
    await this.prisma.settings.update({ where: { userId }, data: { personalModel: enabled } });
    if (enabled) await this.redis.enqueue({ type: 'calibrate', id: userId });
    else await this.prisma.user.update({ where: { id: userId }, data: { calibration: Prisma.DbNull } });
    return this.voiceModel(userId);
  }

  /** 연구 모드 · 기록 내보내기: CSV 여러 개를 zip으로 (원하면 녹음 원본 포함) */
  async export(userId: string, includeAudio: boolean, res: Response) {
    const [attempts, answers, diary, consents, settings] = await Promise.all([
      this.prisma.attempt.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, include: { recording: true, item: { select: { kind: true } } } }),
      this.prisma.listenAnswer.findMany({ where: { linkItem: { link: { userId } } }, include: { linkItem: { include: { attempt: { select: { id: true, targetText: true, heard: true } }, link: { select: { group: true } } } } } }),
      this.prisma.diaryEntry.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
      this.prisma.consent.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.settings(userId),
    ]);
    const recRows = attempts.map((a) => {
      const r = (a.result ?? {}) as any;
      const ops = (r.phonemes?.ops ?? []) as any[];
      return {
        attempt_id: a.id,
        created_at: a.createdAt.toISOString(),
        context: a.context,
        kind: a.item?.kind ?? '',
        target: a.targetText,
        target_pronunciation: r.targetPronunciation ?? a.targetPronunciation,
        sound: a.soundSymbol ?? '',
        status: a.status,
        issue: a.issue ?? '',
        heard: a.heard ?? '',
        passed: a.passed ?? '',
        matched: r.phonemes?.matched ?? '',
        total: r.phonemes?.total ?? '',
        changes: ops.filter((o) => o.type !== 'same' && o.type !== 'allowed').map((o) => `${o.target?.symbol ?? '∅'}→${o.got?.symbol ?? '∅'}:${o.type}`).join(' '),
        intensity_db: r.measures?.intensityDb ?? '',
        pitch_hz: r.measures?.pitchHz ?? '',
        hiss_centroid_khz: r.measures?.hiss?.centroidKHz ?? '',
        hiss_sec: r.measures?.hiss?.hissSec ?? '',
        f1: r.measures?.formants?.f1 ?? '',
        f2: r.measures?.formants?.f2 ?? '',
        rate_syl_per_sec: r.measures?.rateSylPerSec ?? '',
        model: a.modelVersion ?? '',
        audio_file: includeAudio && a.recording && !a.recording.deletedAt ? `audio/${a.id}.wav` : '',
      };
    });
    const ansRows = answers.map((x) => ({
      attempt_id: x.linkItem.attempt.id,
      target: x.linkItem.attempt.targetText,
      app_heard: x.linkItem.attempt.heard ?? '',
      listener_group: x.linkItem.link.group,
      listener_familiarity: x.familiarity,
      listener_wrote: x.answerText ?? '',
      unsure: x.unsure,
      matched: (x.result as any)?.phonemes?.matched ?? '',
      total: (x.result as any)?.phonemes?.total ?? '',
      created_at: x.createdAt.toISOString(),
    }));
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="malang-export-${new Date().toISOString().slice(0, 10)}.zip"`);
    const zip = archiver('zip', { zlib: { level: 6 } });
    zip.pipe(res);
    zip.append(toCsv(recRows), { name: 'recordings.csv' });
    zip.append(toCsv(ansRows), { name: 'listeners.csv' });
    zip.append(toCsv(diary.map((d) => ({ date: d.date, feeling: d.feeling ?? '', note: d.note ?? '' }))), { name: 'diary.csv' });
    zip.append(toCsv(consents.map((c) => ({ type: c.type, granted: c.granted, version: c.version, at: c.createdAt.toISOString() }))), { name: 'consents.csv' });
    zip.append(`말랑말랑 기록 내보내기\n연구 모드: ${settings.researchMode ? '켜짐' : '꺼짐'}\n심의 번호: ${settings.irbNumber ?? '-'}\n다른 사람이 적은 받아쓰기(listeners.csv)를 연구에 쓰려면 그 사람의 동의도 필요해요.\n`, { name: 'README.txt' });
    if (includeAudio) {
      for (const a of attempts) {
        if (!a.recording || a.recording.deletedAt) continue;
        try {
          zip.append(await this.storage.get(a.recording.storageKey), { name: `audio/${a.id}.wav` });
        } catch {
          /* 파일이 없으면 건너뜀 */
        }
      }
    }
    await zip.finalize();
  }

  /** 연결된 로그인 방법 */
  async identities(userId: string) {
    const [u, ids] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { loginId: true, email: true, emailVerifiedAt: true } }),
      this.prisma.identity.findMany({ where: { userId }, select: { provider: true, email: true, createdAt: true } }),
    ]);
    return { loginId: u.loginId, email: u.email, emailVerified: !!u.emailVerifiedAt, providers: ids };
  }

  async deleteAccount(userId: string) {
    await this.storage.removeUser(userId);
    await this.prisma.user.delete({ where: { id: userId } });
  }
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('settings') settings(@CurrentUser() u: AuthUser) {
    return this.users.settings(u.id);
  }
  @Patch('settings') update(@CurrentUser() u: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.users.updateSettings(u.id, dto);
  }
  @Get('consents') consents(@CurrentUser() u: AuthUser) {
    return this.users.consents(u.id);
  }
  @Post('consents') consent(@CurrentUser() u: AuthUser, @Body() dto: ConsentDto) {
    return this.users.addConsent(u.id, dto);
  }
  @Delete('recordings') deleteRecordings(@CurrentUser() u: AuthUser) {
    return this.users.deleteRecordings(u.id);
  }
  @Get('voice-model') voiceModel(@CurrentUser() u: AuthUser) {
    return this.users.voiceModel(u.id);
  }
  @Post('voice-model') setVoiceModel(@CurrentUser() u: AuthUser, @Body() dto: VoiceModelDto) {
    return this.users.setVoiceModel(u.id, dto.enabled);
  }
  @Get('export')
  async export(@CurrentUser() u: AuthUser, @Query('audio') audio: string, @Res() res: Response) {
    await this.users.export(u.id, audio === '1', res);
  }
  @Get('identities') identities(@CurrentUser() u: AuthUser) {
    return this.users.identities(u.id);
  }
  @HttpCode(204)
  @Delete()
  async deleteAccount(@CurrentUser() u: AuthUser) {
    await this.users.deleteAccount(u.id);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
