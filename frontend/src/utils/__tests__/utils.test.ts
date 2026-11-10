import { describe, expect, it } from 'vitest';
import { downsample, encodeWav, precheck } from '../audio';
import { diffChars, josaIGa } from '../hangul';

const tone = (sec: number, amp: number, rate = 16000) => Float32Array.from({ length: Math.floor(sec * rate) }, (_, i) => amp * Math.sin((2 * Math.PI * 200 * i) / rate));
const pad = (x: Float32Array) => {
  const z = new Float32Array(8000);
  const out = new Float32Array(z.length * 2 + x.length);
  out.set(x, z.length);
  return out;
};

describe('audio', () => {
  it('48kHz → 16kHz', () => expect(downsample(new Float32Array(48000), 48000).length).toBe(16000));
  it('WAV 헤더 · 16kHz 모노 PCM16', async () => {
    const b = encodeWav(new Float32Array(160));
    const v = new DataView(await b.arrayBuffer());
    expect(String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3))).toBe('RIFF');
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint16(22, true)).toBe(1);
    expect(b.size).toBe(44 + 320);
  });
  it('기기 검사: 작음 · 짧음 · 깨짐 · 정상', () => {
    expect(precheck(pad(tone(1, 0.002)))).toBe('too_quiet');
    expect(precheck(pad(tone(0.15, 0.3)))).toBe('too_short');
    expect(precheck(pad(tone(1, 1.5).map((x) => Math.max(-1, Math.min(1, x)))))).toBe('clipped');
    expect(precheck(pad(tone(1, 0.3)))).toBeNull();
  });
});

describe('hangul', () => {
  it('다르게 들린 글자만 표시', () => {
    expect(diffChars('사과', '다과').map((c) => c.wrong)).toEqual([true, false]);
    expect(diffChars('사과를 세 개', '사과를 세 개').every((c) => !c.wrong)).toBe(true);
  });
  it('조사', () => {
    expect(josaIGa('ㅅ')).toBe('이');
    expect(josaIGa('ㅏ')).toBe('가');
  });
});
