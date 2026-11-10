import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  GoneException,
  Injectable,
  Logger,
  MessageEvent,
  Module,
  NotFoundException,
  OnModuleInit,
  Param,
  Post,
  Query,
  Res,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { AttemptContext, AttemptStatus, ConsentType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { AuthUser, CurrentUser } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { StorageService } from '../../common/storage.service';
import { ProgressModule } from '../progress/progress.module';
import { ProgressService } from '../progress/progress.service';
import { UsersModule, UsersService } from '../users/users.module';

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
/** 보관 기간: 0 = 내가 지울 때까지 */
export const retentionExpiry = (days: number) => (days > 0 ? new Date(Date.now() + days * 86400_000) : new Date('9999-12-31T00:00:00Z'));
const FINAL: AttemptStatus[] = [AttemptStatus.DONE, AttemptStatus.ISSUE, AttemptStatus.FAILED];

export class CreateAttemptDto {
  @ApiProperty({ enum: AttemptContext }) @IsEnum(AttemptContext) context: AttemptContext;
  @ApiPropertyOptional() @IsOptional() @IsUUID() itemId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() placementSessionId?: string;
  @ApiPropertyOptional({ example: 'ㅅ' }) @IsOptional() @IsString() @MaxLength(4) soundSymbol?: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(100) @Max(120_000) durationMs: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) device?: string;
  @ApiPropertyOptional({ description: '문항 없이 직접 정한 글자 (내 글로 연습의 달라진 단어)' }) @IsOptional() @IsString() @MaxLength(40) text?: string;
  @ApiPropertyOptional({ description: '오프라인 보관 후 다시 올릴 때 중복 방지용 기기 ID' }) @IsOptional() @IsString() @MaxLength(64) clientId?: string;
}

/** WAV(RIFF/WAVE, PCM) 헤더 확인 후 표본율·길이를 읽는다 */
export function parseWav(buf: Buffer): { sampleRate: number; channels: number; bits: number } {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new BadRequestException('WAV 녹음만 받을 수 있어요');
  }
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      const format = buf.readUInt16LE(off + 8);
      if (format !== 1 && format !== 3) throw new BadRequestException('PCM WAV만 받을 수 있어요');
      return { channels: buf.readUInt16LE(off + 10), sampleRate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    }
    off += 8 + size + (size % 2);
  }
  throw new BadRequestException('WAV 형식이 올바르지 않아요');
}

@Injectable()
export class AttemptsService implements OnModuleInit {
  private readonly log = new Logger('Attempts');
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private storage: StorageService,
    private progress: ProgressService,
    private users: UsersService,
  ) {}

  /** 워커 알림을 받으면 바로 진도에 반영 (못 받아도 조회할 때 반영) */
  onModuleInit() {
    const sub = this.redis.client.duplicate();
    sub.on('pmessage', (_p, channel) => {
      const id = channel.split(':')[2];
      this.progress.apply(id).catch((e) => this.log.warn(`apply failed ${id}: ${e.message}`));
    });
    sub.psubscribe('malang:attempt:*').catch((e) => this.log.warn(`subscribe failed: ${e.message}`));
  }

  async create(user: AuthUser, dto: CreateAttemptDto, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('녹음 파일이 없어요');
    if (file.size > MAX_AUDIO_BYTES) throw new BadRequestException('녹음이 너무 길어요');
    if (!(await this.users.hasConsent(user.id, ConsentType.VOICE_RECORDING))) {
      throw new ForbiddenException({ message: '녹음 전에 목소리 녹음 동의가 필요해요', code: 'VOICE_CONSENT_REQUIRED' });
    }
    const wav = parseWav(file.buffer);
    if (dto.clientId) {
      const dup = await this.prisma.attempt.findUnique({ where: { userId_clientId: { userId: user.id, clientId: dto.clientId } } });
      if (dup) return dup;
    }

    let targetText = '아';
    let targetPronunciation = '아';
    if (dto.context !== AttemptContext.MIC_CHECK && !dto.itemId && dto.text) {
      targetText = dto.text.trim();
      targetPronunciation = ''; // 워커가 표준발음법으로 만든다
    } else if (dto.context !== AttemptContext.MIC_CHECK) {
      if (!dto.itemId) throw new BadRequestException('어떤 문항인지 알려주세요');
      const item = await this.prisma.lessonItem.findUnique({ where: { id: dto.itemId } });
      if (!item) throw new NotFoundException('없는 문항이에요');
      targetText = item.text;
      targetPronunciation = item.pronunciation;
    }
    if (dto.placementSessionId) {
      const s = await this.prisma.placementSession.findFirst({ where: { id: dto.placementSessionId, userId: user.id } });
      if (!s) throw new NotFoundException('진단을 찾을 수 없어요');
    }
    const settings = await this.prisma.settings.findUnique({ where: { userId: user.id } });
    const storageKey = await this.storage.put(user.id, file.buffer);
    const recording = await this.prisma.recording.create({
      data: {
        userId: user.id,
        storageKey,
        durationMs: dto.durationMs,
        sampleRate: wav.sampleRate,
        sizeBytes: file.size,
        device: dto.device,
        expiresAt: retentionExpiry(settings?.retentionDays ?? 90),
      },
    });
    const attempt = await this.prisma.attempt.create({
      data: {
        userId: user.id,
        itemId: dto.itemId,
        targetText,
        targetPronunciation,
        recordingId: recording.id,
        placementSessionId: dto.placementSessionId,
        context: dto.context,
        soundSymbol: dto.soundSymbol,
        clientId: dto.clientId,
      },
    });
    await this.redis.enqueue({ type: 'attempt', id: attempt.id });
    return attempt;
  }

  async get(userId: string, id: string) {
    const a = await this.prisma.attempt.findFirst({ where: { id, userId }, include: { item: { select: { kind: true, targetSounds: true, note: true } }, recording: { select: { deletedAt: true, durationMs: true } } } });
    if (!a) throw new NotFoundException('녹음을 찾을 수 없어요');
    if (FINAL.includes(a.status) && !a.appliedAt) await this.progress.apply(a.id);
    const tryNumber = a.itemId
      ? await this.prisma.attempt.count({ where: { userId, itemId: a.itemId, status: AttemptStatus.DONE, createdAt: { lte: a.createdAt } } })
      : null;
    const { recording, ...rest } = a;
    return { ...rest, tryNumber, audioAvailable: !!recording && !recording.deletedAt, durationMs: recording?.durationMs ?? null };
  }

  list(userId: string, sound?: string, limit = 30) {
    return this.prisma.attempt.findMany({
      where: { userId, context: { not: AttemptContext.MIC_CHECK }, ...(sound ? { soundSymbol: sound } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: { id: true, targetText: true, heard: true, passed: true, status: true, issue: true, context: true, soundSymbol: true, createdAt: true, result: true, recordingId: true, itemId: true },
    });
  }

  /** 분석 진행을 실시간으로 (SSE). 이미 끝났으면 바로 보내고 닫는다. 60초 지나면 닫는다(앱은 폴링으로 이어감). */
  events(userId: string, id: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((sub) => {
      let closed = false;
      const send = async () => {
        const a = await this.prisma.attempt.findFirst({ where: { id, userId }, select: { status: true, issue: true } });
        if (!a) {
          sub.error(new NotFoundException());
          return;
        }
        sub.next({ data: { status: a.status, issue: a.issue } });
        if (FINAL.includes(a.status)) {
          await this.progress.apply(id);
          closed = true;
          sub.complete();
        }
      };
      const off = this.redis.on(`malang:attempt:${id}`, () => void send());
      const timer = setTimeout(() => sub.complete(), 60_000);
      void send();
      return () => {
        off();
        clearTimeout(timer);
        closed = true;
      };
    });
  }

  async audio(userId: string, id: string) {
    const a = await this.prisma.attempt.findFirst({ where: { id, userId }, include: { recording: true } });
    if (!a?.recording) throw new NotFoundException('녹음을 찾을 수 없어요');
    if (a.recording.deletedAt) throw new GoneException('보관 기간이 지나 원본을 지웠어요');
    return this.storage.get(a.recording.storageKey);
  }

  async report(userId: string, attemptId: string, reason: string) {
    const a = await this.prisma.attempt.findFirst({ where: { id: attemptId, userId } });
    if (!a) throw new NotFoundException('녹음을 찾을 수 없어요');
    return this.prisma.report.create({ data: { userId, attemptId, reason } });
  }
}

class ReportDto {
  @ApiProperty() @IsString() @MaxLength(300) reason: string;
}

@ApiTags('attempts')
@ApiBearerAuth()
@Controller('attempts')
export class AttemptsController {
  constructor(private attempts: AttemptsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { audio: { type: 'string', format: 'binary' }, context: { type: 'string' }, itemId: { type: 'string' }, durationMs: { type: 'number' } } } })
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES } }))
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateAttemptDto, @UploadedFile() file: Express.Multer.File) {
    return this.attempts.create(u, dto, file);
  }

  @Get() list(@CurrentUser() u: AuthUser, @Query('sound') sound?: string, @Query('limit') limit?: string) {
    return this.attempts.list(u.id, sound, limit ? Number(limit) : undefined);
  }

  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.attempts.get(u.id, id);
  }

  @Sse(':id/events') events(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.attempts.events(u.id, id);
  }

  @Get(':id/audio')
  async audio(@CurrentUser() u: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const buf = await this.attempts.audio(u.id, id);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buf);
  }

  @Post(':id/report') report(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReportDto) {
    return this.attempts.report(u.id, id, dto.reason);
  }
}

@Module({ imports: [ProgressModule, UsersModule], controllers: [AttemptsController], providers: [AttemptsService], exports: [AttemptsService] })
export class AttemptsModule {}
