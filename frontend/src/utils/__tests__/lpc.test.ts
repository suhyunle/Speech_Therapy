import { describe, expect, it } from 'vitest';
import { formantsFromFrame, nearestVowel, VOWEL_TARGETS } from '../lpc';

/** 성대 펄스(120Hz)를 두 공명기(F1·F2)에 통과시킨 합성 모음 */
function vowel(f1: number, f2: number, rate = 44100, n = 2048) {
  const x = new Float32Array(n);
  for (let i = 0; i < n; i += Math.round(rate / 120)) x[i] = 1;
  const res = (sig: Float32Array, f: number, bw: number) => {
    const r = Math.exp((-Math.PI * bw) / rate);
    const c = 2 * r * Math.cos((2 * Math.PI * f) / rate);
    const out = new Float32Array(sig.length);
    for (let i = 0; i < sig.length; i++) out[i] = sig[i] + c * (out[i - 1] ?? 0) - r * r * (out[i - 2] ?? 0);
    return out;
  };
  return res(res(x, f1, 80), f2, 100);
}

describe('LPC 포먼트', () => {
  it.each([
    [800, 1300],
    [350, 2300],
    [450, 900],
  ])('F1=%i F2=%i 를 15%% 안에서 찾는다', (f1, f2) => {
    const fm = formantsFromFrame(vowel(f1, f2), 44100)!;
    expect(fm).not.toBeNull();
    expect(Math.abs(fm.f1 - f1) / f1).toBeLessThan(0.15);
    expect(Math.abs(fm.f2 - f2) / f2).toBeLessThan(0.15);
  });
  it('가장 가까운 모음', () => {
    expect(nearestVowel(900, 1550, VOWEL_TARGETS.f)).toBe('ㅏ');
    expect(nearestVowel(320, 2700, VOWEL_TARGETS.f)).toBe('ㅣ');
  });
});
