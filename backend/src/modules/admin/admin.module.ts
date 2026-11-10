import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { ItemKind, ItemStatus, Role } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';

export class ItemDto {
  @ApiProperty({ enum: ItemKind }) @IsEnum(ItemKind) kind: ItemKind;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(500) text: string;
  @ApiProperty({ description: '표준 발음 (한글). 예: 같이 → 가치' }) @IsString() @MinLength(1) @MaxLength(500) pronunciation: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) targetSounds: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) note?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() placement?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() placementOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4) baselineFor?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['down', 'up']) intonation?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) difficulty?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) source?: string;
}
export class UpdateItemDto extends PartialType(ItemDto) {}

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  items(q: { kind?: ItemKind; status?: ItemStatus; sound?: string; search?: string }) {
    return this.prisma.lessonItem.findMany({
      where: {
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.sound ? { targetSounds: { has: q.sound } } : {}),
        ...(q.search ? { text: { contains: q.search } } : {}),
      },
      orderBy: [{ kind: 'asc' }, { text: 'asc' }],
      include: { reviewedBy: { select: { name: true } }, _count: { select: { attempts: true } } },
    });
  }
  create(dto: ItemDto) {
    return this.prisma.lessonItem.create({ data: { ...dto, status: ItemStatus.DRAFT } });
  }
  /** 정답이 바뀌면 검토를 다시 받아야 한다 */
  update(id: string, dto: UpdateItemDto) {
    const changesAnswer = dto.text !== undefined || dto.pronunciation !== undefined || dto.targetSounds !== undefined;
    return this.prisma.lessonItem.update({ where: { id }, data: { ...dto, ...(changesAnswer ? { status: ItemStatus.DRAFT, reviewedById: null, reviewedAt: null } : {}) } });
  }
  remove(id: string) {
    return this.prisma.lessonItem.delete({ where: { id } });
  }
  review(id: string, reviewerId: string) {
    return this.prisma.lessonItem.update({ where: { id }, data: { status: ItemStatus.REVIEWED, reviewedById: reviewerId, reviewedAt: new Date() } });
  }
  reports() {
    return this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { attempt: { select: { targetText: true, heard: true, status: true, modelVersion: true, createdAt: true } } },
    });
  }
  resolveReport(id: string) {
    return this.prisma.report.update({ where: { id }, data: { resolved: true } });
  }
  /** 개인 식별 없이 숫자만 */
  async stats() {
    const [users, guests, attempts, failed, items, draft] = await Promise.all([
      this.prisma.user.count({ where: { isGuest: false } }),
      this.prisma.user.count({ where: { isGuest: true } }),
      this.prisma.attempt.count(),
      this.prisma.attempt.count({ where: { status: 'FAILED' } }),
      this.prisma.lessonItem.count(),
      this.prisma.lessonItem.count({ where: { status: ItemStatus.DRAFT } }),
    ]);
    return { users, guests, attempts, failed, items, draft };
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}
  @Get('stats') stats() {
    return this.admin.stats();
  }
  @Get('items') items(@Query('kind') kind?: ItemKind, @Query('status') status?: ItemStatus, @Query('sound') sound?: string, @Query('search') search?: string) {
    return this.admin.items({ kind, status, sound, search });
  }
  @Post('items') create(@Body() dto: ItemDto) {
    return this.admin.create(dto);
  }
  @Patch('items/:id') update(@Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.admin.update(id, dto);
  }
  @Delete('items/:id') remove(@Param('id') id: string) {
    return this.admin.remove(id);
  }
  @Post('items/:id/review') review(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.admin.review(id, u.id);
  }
  @Get('reports') reports() {
    return this.admin.reports();
  }
  @Post('reports/:id/resolve') resolve(@Param('id') id: string) {
    return this.admin.resolveReport(id);
  }
}

@Module({ controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
