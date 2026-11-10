import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  MessageEvent,
  Module,
  NotFoundException,
  Param,
  Post,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ConsentType, RunStatus, ScriptStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Observable } from 'rxjs';
import { AuthUser, CurrentUser } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { StorageService } from '../../common/storage.service';
import { UsersModule, UsersService } from '../users/users.module';

const MAX_DOC = 30 * 1024 * 1024;
const MAX_AUDIO = 80 * 1024 * 1024; // 발표 녹음 (약 30분 mp3)

export class CreateScriptDto {
  @ApiPropertyOptional({ description: '붙여넣은 글 (파일 대신)' }) @IsOptional() @IsString() @MaxLength(20000) text?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) title?: string;
}

export class CreateRunDto {
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) slideFrom: number;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) slideTo: number;
  @ApiPropertyOptional({ description: '내 말로 풀어 말해도 괜찮아요' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  freeSpeech?: boolean;
}

export function detectSource(name: string, mime: string): 'pptx' | 'pdf' | 'image' | null {
  const n = name.toLowerCase();
  if (n.endsWith('.pptx') || mime.includes('presentationml')) return 'pptx';
  if (n.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (/\.(png|jpe?g|webp|heic)$/.test(n) || mime.startsWith('image/')) return 'image';
  return null;
}

/** 붙여넣은 글: 빈 줄로 나눈 덩어리를 한 장으로 (워커의 extract 와 같은 규칙) */
export function splitText(text: string) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return (blocks.length ? blocks : [text.trim()]).map((t, i) => ({ n: i + 1, text: t }));
}

@Injectable()
export class ScriptsService {
  constructor(private prisma: PrismaService, private storage: StorageService, private redis: RedisService, private users: UsersService) {}

  async create(userId: string, dto: CreateScriptDto, file?: Express.Multer.File) {
    if (file) {
      if (file.size > MAX_DOC) throw new BadRequestException('파일이 너무 커요 (30MB까지)');
      const source = detectSource(file.originalname, file.mimetype);
      if (!source) throw new BadRequestException('PPT(pptx) · PDF · 사진만 올릴 수 있어요');
      const storageKey = await this.storage.put(`${userId}/scripts`, file.buffer);
      const doc = await this.prisma.scriptDoc.create({ data: { userId, title: dto.title?.trim() || Buffer.from(file.originalname, 'latin1').toString('utf8'), sourceType: source, storageKey } });
      await this.redis.enqueue({ type: 'script_extract', id: doc.id });
      return doc;
    }
    const text = dto.text?.trim();
    if (!text) throw new BadRequestException('파일을 고르거나 글을 붙여넣어 주세요');
    const slides = splitText(text);
    return this.prisma.scriptDoc.create({
      data: { userId, title: dto.title?.trim() || text.slice(0, 20), sourceType: 'text', status: ScriptStatus.READY, slides, charCount: slides.reduce((a, s) => a + s.text.length, 0) },
    });
  }

  list(userId: string) {
    return this.prisma.scriptDoc.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, sourceType: true, status: true, charCount: true, createdAt: true, error: true, slides: true, runs: { orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, status: true, createdAt: true, slideFrom: true, slideTo: true, durationMs: true } } },
    });
  }

  async get(userId: string, id: string) {
    const d = await this.prisma.scriptDoc.findFirst({
      where: { id, userId },
      omit: { storageKey: true },
      include: { runs: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, status: true, createdAt: true, slideFrom: true, slideTo: true, durationMs: true } } },
    });
    if (!d) throw new NotFoundException('원고를 찾을 수 없어요');
    return d;
  }

  /** 원고는 비교에만 쓰고, 원하면 바로 지울 수 있어요 */
  async remove(userId: string, id: string) {
    const d = await this.prisma.scriptDoc.findFirst({ where: { id, userId } });
    if (!d) throw new NotFoundException('원고를 찾을 수 없어요');
    const runs = await this.prisma.scriptRun.findMany({ where: { docId: id } });
    for (const r of runs) if (r.storageKey) await this.storage.remove(r.storageKey);
    if (d.storageKey) await this.storage.remove(d.storageKey);
    await this.prisma.scriptDoc.delete({ where: { id } });
  }

  async createRun(user: AuthUser, docId: string, dto: CreateRunDto, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('녹음 파일이 없어요');
    if (file.size > MAX_AUDIO) throw new BadRequestException('녹음이 너무 커요 (80MB까지)');
    if (!(await this.users.hasConsent(user.id, ConsentType.VOICE_RECORDING))) {
      throw new BadRequestException({ message: '녹음 전에 목소리 녹음 동의가 필요해요', code: 'VOICE_CONSENT_REQUIRED' });
    }
    const doc = await this.get(user.id, docId);
    if (doc.status !== ScriptStatus.READY) throw new BadRequestException('원고에서 글을 아직 다 찾지 못했어요');
    const n = (doc.slides as any[]).length;
    const from = Math.min(dto.slideFrom, n);
    const to = Math.max(from, Math.min(dto.slideTo, n));
    const storageKey = await this.storage.put(`${user.id}/scripts`, file.buffer);
    const run = await this.prisma.scriptRun.create({ data: { docId, userId: user.id, slideFrom: from, slideTo: to, freeSpeech: dto.freeSpeech ?? true, storageKey } });
    await this.redis.enqueue({ type: 'script_run', id: run.id });
    return run;
  }

  async run(userId: string, id: string) {
    const r = await this.prisma.scriptRun.findFirst({ where: { id, userId }, include: { doc: { select: { title: true, slides: true, sourceType: true } } } });
    if (!r) throw new NotFoundException('발표 연습을 찾을 수 없어요');
    return r;
  }

  events(userId: string, id: string, channel: 'script_run' | 'script_extract'): Observable<MessageEvent> {
    return new Observable<MessageEvent>((sub) => {
      const send = async () => {
        const row =
          channel === 'script_run'
            ? await this.prisma.scriptRun.findFirst({ where: { id, userId }, select: { status: true } })
            : await this.prisma.scriptDoc.findFirst({ where: { id, userId }, select: { status: true } });
        if (!row) return sub.error(new NotFoundException());
        sub.next({ data: { status: row.status } });
        if (['DONE', 'FAILED', 'READY'].includes(row.status)) sub.complete();
      };
      const off = this.redis.on(`malang:${channel}:${id}`, () => void send());
      const timer = setTimeout(() => sub.complete(), 180_000);
      void send();
      return () => (off(), clearTimeout(timer));
    });
  }
}

@ApiTags('scripts')
@ApiBearerAuth()
@Controller()
export class ScriptsController {
  constructor(private s: ScriptsService) {}

  @Post('scripts')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOC } }))
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateScriptDto, @UploadedFile() file?: Express.Multer.File) {
    return this.s.create(u.id, dto, file);
  }
  @Get('scripts') list(@CurrentUser() u: AuthUser) {
    return this.s.list(u.id);
  }
  @Get('scripts/:id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.s.get(u.id, id);
  }
  @Sse('scripts/:id/events') docEvents(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.s.events(u.id, id, 'script_extract');
  }
  @HttpCode(204)
  @Delete('scripts/:id')
  async remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.s.remove(u.id, id);
  }
  @Post('scripts/:id/runs')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO } }))
  createRun(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CreateRunDto, @UploadedFile() file?: Express.Multer.File) {
    return this.s.createRun(u, id, dto, file);
  }
  @Get('script-runs/:id') run(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.s.run(u.id, id);
  }
  @Sse('script-runs/:id/events') runEvents(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.s.events(u.id, id, 'script_run');
  }
}

@Module({ imports: [UsersModule], controllers: [ScriptsController], providers: [ScriptsService] })
export class ScriptsModule {}
