import { Controller, Get, Injectable, Module, NotFoundException, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma.service';

/** 연습 순서 (디자인 LearnOrder): 모음 → 이중모음 → ㅅ·ㅆ → 가·카·까 (그 밖 자음) */
export const GROUP_ORDER = ['vowel', 'diphthong', 'fric', 'stop'] as const;
export const GROUP_LABEL: Record<string, string> = { vowel: '모음', diphthong: '이중', fric: 'ㅅ·ㅆ', stop: '가카까', prosody: '억양' };

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  sounds() {
    return this.prisma.sound.findMany({ orderBy: { orderIndex: 'asc' } });
  }

  async sound(symbol: string) {
    const s = await this.prisma.sound.findUnique({ where: { symbol } });
    if (!s) throw new NotFoundException('없는 소리예요');
    const items = await this.prisma.lessonItem.findMany({
      where: { targetSounds: { has: symbol }, exercise: null },
      orderBy: [{ kind: 'asc' }, { difficulty: 'asc' }, { text: 'asc' }],
      select: { id: true, kind: true, text: true, pronunciation: true, note: true, status: true, baselineFor: true },
    });
    return { ...s, items };
  }

  async item(id: string) {
    const it = await this.prisma.lessonItem.findUnique({ where: { id } });
    if (!it) throw new NotFoundException('없는 문항이에요');
    return it;
  }
}

@ApiTags('content')
@ApiBearerAuth()
@Controller()
export class ContentController {
  constructor(private content: ContentService) {}
  @Get('sounds') sounds() {
    return this.content.sounds();
  }
  @Get('sounds/:symbol') sound(@Param('symbol') symbol: string) {
    return this.content.sound(symbol);
  }
  @Get('items/:id') item(@Param('id') id: string) {
    return this.content.item(id);
  }
}

@Module({ controllers: [ContentController], providers: [ContentService], exports: [ContentService] })
export class ContentModule {}
