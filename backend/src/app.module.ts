import { Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from './common/auth';
import { PrismaModule, PrismaService } from './common/prisma.service';
import { RedisModule } from './common/redis.service';
import { StorageModule, StorageService } from './common/storage.service';
import { AllExceptionsFilter } from './common/util';
import { AdminModule } from './modules/admin/admin.module';
import { AttemptsModule } from './modules/attempts/attempts.module';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { OAuthService } from './modules/auth/oauth.service';
import { ContentModule } from './modules/content/content.module';
import { DiaryModule } from './modules/diary/diary.module';
import { ListenModule } from './modules/listen/listen.module';
import { PlacementModule } from './modules/placement/placement.module';
import { PlanModule } from './modules/plan/plan.module';
import { ProgressModule } from './modules/progress/progress.module';
import { UsersModule } from './modules/users/users.module';
import { TrainingModule } from './modules/training/training.module';
import { ScriptsModule } from './modules/scripts/scripts.module';
import { NotifyModule } from './modules/notify/notify.module';

/** 보관 기간이 지난 녹음 원본을 1시간마다 지운다 (분석 글자·측정값은 남김) */
@Injectable()
export class RetentionJob implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Retention');
  private timer?: NodeJS.Timeout;
  constructor(private prisma: PrismaService, private storage: StorageService) {}
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.run(), 3600_000);
    void this.run();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async run() {
    const expired = await this.prisma.recording.findMany({ where: { expiresAt: { lt: new Date() }, deletedAt: null }, take: 500 });
    for (const r of expired) {
      await this.storage.remove(r.storageKey);
      await this.prisma.recording.update({ where: { id: r.id }, data: { deletedAt: new Date() } });
    }
    if (expired.length) this.log.log(`deleted ${expired.length} expired recordings`);
    return expired.length;
  }
}

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    StorageModule,
    JwtModule.registerAsync({ global: true, useFactory: () => ({ secret: process.env.JWT_SECRET }) }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 300 }], skipIf: () => process.env.NODE_ENV === 'test' }),
    UsersModule,
    ContentModule,
    PlacementModule,
    ProgressModule,
    PlanModule,
    AttemptsModule,
    DiaryModule,
    ListenModule,
    AdminModule,
    TrainingModule,
    ScriptsModule,
    NotifyModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OAuthService,
    RetentionJob,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
