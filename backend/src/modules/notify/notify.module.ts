import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsObject, IsString, MaxLength } from 'class-validator';
import * as webpush from 'web-push';
import { AuthUser, CurrentUser, Public } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { seoulDate } from '../../common/util';

export class SubscribeDto {
  @ApiProperty() @IsString() @MaxLength(1000) endpoint: string;
  @ApiProperty() @IsObject() keys: { p256dh: string; auth: string };
}
export class NewsletterDto {
  @ApiProperty() @IsEmail({}, { message: '이메일 주소를 확인해 주세요' }) @MaxLength(200) email: string;
}

/** 지금 서울 시각 "HH:MM" */
export function seoulHHMM(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/**
 * 연습 알림: 브라우저 알림(Web Push, VAPID). 매분 확인해서 알림 시각이 된 사람에게 하루 한 번 보낸다.
 * 오늘 목표를 이미 끝냈으면 보내지 않는다. 소리 대신 진동 패턴과 화면 알림만.
 */
@Injectable()
export class NotifyService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Notify');
  private timer?: NodeJS.Timeout;
  readonly enabled: boolean;

  constructor(private prisma: PrismaService) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    this.enabled = !!(pub && priv);
    if (this.enabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:hello@malangmalang.app', pub!, priv!);
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || !this.enabled) return;
    this.timer = setInterval(() => void this.tick().catch((e) => this.log.warn(e.message)), 60_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  publicKey() {
    return { enabled: this.enabled, key: process.env.VAPID_PUBLIC_KEY ?? null };
  }

  async subscribe(userId: string, dto: SubscribeDto) {
    if (!this.enabled) throw new BadRequestException('알림 서버 설정이 아직 없어요');
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      update: { userId, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
    });
  }

  async unsubscribe(userId: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId } });
  }

  /** 알림 시각이 된 사람에게 보낸다. 실패(만료된 구독)는 지운다. */
  async tick(now = new Date()) {
    const hhmm = seoulHHMM(now);
    const date = seoulDate(now);
    const subs = await this.prisma.pushSubscription.findMany({
      where: { OR: [{ lastSent: null }, { lastSent: { not: date } }], user: { settings: { reminderEnabled: true, reminderTime: hhmm } } },
      include: { user: { include: { settings: true, dailySessions: { where: { date } } } } },
    });
    let sent = 0;
    for (const s of subs) {
      const day = s.user.dailySessions[0];
      if (day?.completedAt) continue;
      const left = Math.max(0, (s.user.settings?.dailyGoal ?? 5) - (day?.completedCount ?? 0));
      await this.send(s, { title: '말랑말랑', body: left ? `오늘 ${left}개 해볼까요? 약 ${Math.max(1, Math.round(left * 1.2))}분이면 끝나요` : '오늘의 학습을 이어서 해요', url: '/home' });
      sent++;
    }
    return sent;
  }

  async send(s: { id: string; endpoint: string; p256dh: string; auth: string }, payload: object) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      await this.prisma.pushSubscription.update({ where: { id: s.id }, data: { lastSent: seoulDate() } });
      return true;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
      this.log.warn(`push failed: ${e?.statusCode ?? e?.message}`);
      return false;
    }
  }

  async test(userId: string) {
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (!subs.length) throw new BadRequestException('이 기기에서 알림을 먼저 허용해 주세요');
    const ok = await Promise.all(subs.map((s) => this.send(s, { title: '말랑말랑', body: '알림이 잘 와요! 이 시간에 연습을 알려드릴게요', url: '/settings' })));
    return { sent: ok.filter(Boolean).length, total: subs.length };
  }

  async newsletter(email: string) {
    await this.prisma.newsletterSignup.upsert({ where: { email: email.toLowerCase() }, create: { email: email.toLowerCase() }, update: {} });
    return { ok: true };
  }
}

@ApiTags('notify')
@Controller()
export class NotifyController {
  constructor(private n: NotifyService) {}
  @Public() @Get('push/key') key() {
    return this.n.publicKey();
  }
  @ApiBearerAuth() @Post('push/subscribe') subscribe(@CurrentUser() u: AuthUser, @Body() dto: SubscribeDto) {
    return this.n.subscribe(u.id, dto);
  }
  @ApiBearerAuth() @HttpCode(204) @Delete('push/subscribe') async unsubscribe(@CurrentUser() u: AuthUser) {
    await this.n.unsubscribe(u.id);
  }
  @ApiBearerAuth() @Post('push/test') test(@CurrentUser() u: AuthUser) {
    return this.n.test(u.id);
  }
  /** 랜딩페이지 '출시 소식 받기' */
  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } }) @Post('newsletter') newsletter(@Body() dto: NewsletterDto) {
    return this.n.newsletter(dto.email);
  }
}

@Module({ controllers: [NotifyController], providers: [NotifyService], exports: [NotifyService] })
export class NotifyModule {}
