import { BadRequestException } from '@nestjs/common';
import { StorageService } from '../common/storage.service';
import { addDays, mondayOf, seoulDate } from '../common/util';
import { parseWav } from './attempts/attempts.module';
import { decide, wordMetrics } from './placement/placement.module';
import { GOAL_MIX, rotate } from './plan/plan.module';
import { verdictsFromOps } from './progress/progress.service';

const op = (symbol: string | null, type: string, pos = 'onset') => ({ target: symbol ? { symbol, pos } : null, type });

describe('verdictsFromOps', () => {
  it('첫소리·모음만 보고, 하나라도 틀리면 그 소리는 다시', () => {
    const v = verdictsFromOps([op('ㅅ', 'sub'), op('ㅏ', 'same', 'vowel'), op('ㄱ', 'same'), op('ㅘ', 'same', 'vowel'), op('ㅅ', 'same')]);
    expect(v).toEqual({ ㅅ: false, ㅏ: true, ㄱ: true, ㅘ: true });
  });
  it('받침은 따로 세지 않지만 ㅇ 받침은 센다', () => {
    const v = verdictsFromOps([op('ㄱ', 'del', 'coda'), op('ㅇ', 'same', 'coda')]);
    expect(v).toEqual({ ㅇ: true });
  });
  it('확실하지 않음은 null', () => {
    expect(verdictsFromOps([op('ㄷ', 'unsure')])).toEqual({ ㄷ: null });
  });
});

describe('첫 진단 판정 decide', () => {
  it('두 단계 이상에서 모두 통과해야 이미 좋음', () => {
    const r = decide({
      ㄹ: { syllable: true, word: true, sentence: true },
      ㅅ: { syllable: true, word: false, sentence: null },
      ㅋ: { syllable: true, word: null, sentence: null },
      ㅃ: { syllable: null, word: null, sentence: null },
    });
    expect(r.cleared).toEqual(['ㄹ']);
    expect(r.practice).toEqual(['ㅅ']);
    expect(r.unknown.sort()).toEqual(['ㅃ', 'ㅋ'].sort());
  });
});

describe('PCC · PWC', () => {
  it('자음 정확도와 낱말 정확도', () => {
    const sagwa = [op('ㅅ', 'sub'), op('ㅏ', 'same', 'vowel'), op('ㄱ', 'same'), op('ㅘ', 'same', 'vowel')];
    const dari = [op('ㄷ', 'same'), op('ㅏ', 'same', 'vowel'), op('ㄹ', 'same'), op('ㅣ', 'same', 'vowel')];
    expect(wordMetrics([sagwa, dari])).toEqual({ pcc: { correct: 3, total: 4 }, pwc: { correct: 1, total: 2 } });
  });
  it('확실하지 않은 단어는 빼고 센다', () => {
    expect(wordMetrics([[op('ㄷ', 'unsure')]])).toEqual({ pcc: null, pwc: null });
  });
});

describe('오늘의 학습 구성', () => {
  it('목표별 단어·문장 수 (GoalSetup)', () => {
    expect(GOAL_MIX[3]).toEqual({ words: 3, sentences: 0 });
    expect(GOAL_MIX[5]).toEqual({ words: 4, sentences: 1 });
    expect(GOAL_MIX[10]).toEqual({ words: 7, sentences: 3 });
  });
  it('기초선 단어 1개를 포함하고 날마다 돌린다', () => {
    const items = [{ id: 'b1', baselineFor: 'ㅅ' }, { id: 'b2', baselineFor: 'ㅅ' }, ...'abcdefgh'.split('').map((id) => ({ id, baselineFor: null }))];
    const d1 = rotate(items, 4, '2026-11-10');
    const d2 = rotate(items, 4, '2026-11-11');
    expect(d1).toHaveLength(4);
    expect(d1.filter((i) => i.baselineFor)).toHaveLength(1);
    expect(new Set(d1.map((i) => i.id)).size).toBe(4);
    expect(d1.map((i) => i.id)).not.toEqual(d2.map((i) => i.id));
  });
});

describe('날짜 (Asia/Seoul)', () => {
  it('서울 기준 날짜와 주 시작', () => {
    expect(seoulDate(new Date('2026-11-09T15:30:00Z'))).toBe('2026-11-10');
    expect(mondayOf('2026-11-10')).toBe('2026-11-09');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('WAV 확인', () => {
  const wav = (rate = 16000) => {
    const b = Buffer.alloc(44);
    b.write('RIFF', 0);
    b.writeUInt32LE(36, 4);
    b.write('WAVE', 8);
    b.write('fmt ', 12);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate * 2, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36);
    return b;
  };
  it('PCM WAV를 읽는다', () => expect(parseWav(wav())).toEqual({ sampleRate: 16000, channels: 1, bits: 16 }));
  it('WAV가 아니면 거절', () => expect(() => parseWav(Buffer.from('not a wav file at all, definitely not one'))).toThrow(BadRequestException));
});

describe('녹음 암호화', () => {
  beforeAll(() => (process.env.RECORDING_KEY = Buffer.alloc(32, 7).toString('base64')));
  it('AES-256-GCM 왕복, 파일마다 IV가 다르다', () => {
    const s = new StorageService();
    const plain = Buffer.from('목소리 녹음');
    const a = s.encrypt(plain);
    const b = s.encrypt(plain);
    expect(a.equals(b)).toBe(false);
    expect(s.decrypt(a).toString()).toBe('목소리 녹음');
  });
  it('변조되면 복호화 실패', () => {
    const s = new StorageService();
    const a = s.encrypt(Buffer.from('abc'));
    a[13] ^= 1;
    expect(() => s.decrypt(a)).toThrow();
  });
});

import { seoulHHMM } from './notify/notify.module';
import { detectSource, splitText } from './scripts/scripts.module';
import { toCsv } from './users/users.module';

describe('알림 · 원고 · 내보내기 도우미', () => {
  it('서울 시각 HH:MM', () => expect(seoulHHMM(new Date('2026-11-10T11:00:00Z'))).toBe('20:00'));
  it('원고 파일 종류', () => {
    expect(detectSource('발표.pptx', '')).toBe('pptx');
    expect(detectSource('a.PDF', '')).toBe('pdf');
    expect(detectSource('photo.jpg', 'image/jpeg')).toBe('image');
    expect(detectSource('memo.docx', '')).toBeNull();
  });
  it('붙여넣은 글은 빈 줄로 나눈다', () => expect(splitText('하나\n둘\n\n셋')).toEqual([{ n: 1, text: '하나 둘' }, { n: 2, text: '셋' }]));
  it('CSV 따옴표 처리 · 엑셀용 BOM', () => {
    const c = toCsv([{ a: '쉼표, 있음', b: '"따옴표"' }]);
    expect(c.startsWith('﻿')).toBe(true);
    expect(c).toContain('"쉼표, 있음"');
    expect(c).toContain('"""따옴표"""');
  });
});
