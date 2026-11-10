import { Body, Controller, Get, Injectable, Module, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Feeling } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { seoulDate } from '../../common/util';

export class DiaryDto {
  @ApiPropertyOptional({ enum: Feeling }) @IsOptional() @IsEnum(Feeling) feeling?: Feeling;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) note?: string;
}

@Injectable()
export class DiaryService {
  constructor(private prisma: PrismaService) {}

  async today(userId: string) {
    const date = seoulDate();
    const [entry, day] = await Promise.all([
      this.prisma.diaryEntry.findUnique({ where: { userId_date: { userId, date } } }),
      this.prisma.dailySession.findUnique({ where: { userId_date: { userId, date } } }),
    ]);
    return { date, entry, recordings: day?.recordingCount ?? 0, completed: day?.completedCount ?? 0, goal: day?.goal ?? null };
  }

  save(userId: string, dto: DiaryDto) {
    const date = seoulDate();
    return this.prisma.diaryEntry.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, feeling: dto.feeling, note: dto.note?.trim() || null },
      update: { feeling: dto.feeling, note: dto.note?.trim() || null },
    });
  }
}

@ApiTags('diary')
@ApiBearerAuth()
@Controller('diary')
export class DiaryController {
  constructor(private diary: DiaryService) {}
  @Get('today') today(@CurrentUser() u: AuthUser) {
    return this.diary.today(u.id);
  }
  @Put('today') save(@CurrentUser() u: AuthUser, @Body() dto: DiaryDto) {
    return this.diary.save(u.id, dto);
  }
}

@Module({ controllers: [DiaryController], providers: [DiaryService] })
export class DiaryModule {}
