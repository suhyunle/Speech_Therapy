'use client';
import { useEffect, useState } from 'react';

/** 디자인 Vowels 보드의 입모양 그림을 그대로 옮긴 것 (입술 너비·벌림·둥글림·이·혀) */
export type LipParams = { w: number; o: number; lt: number; teeth: number; low: number; tongue: number; round: number; smile: number };

export const SHAPES: Record<string, LipParams> = {
  REST: { w: 42, o: 0.6, lt: 13, teeth: 0, low: 0, tongue: 0, round: 0, smile: 0 },
  A: { w: 54, o: 22, lt: 14, teeth: 1, low: 1, tongue: 1, round: 0, smile: 0 },
  EO: { w: 46, o: 14, lt: 14, teeth: 1, low: 0, tongue: 1, round: 0, smile: 0 },
  O: { w: 32, o: 11, lt: 19, teeth: 0, low: 0, tongue: 1, round: 1, smile: 0 },
  U: { w: 26, o: 7, lt: 20, teeth: 0, low: 0, tongue: 0, round: 1, smile: 0 },
  EU: { w: 58, o: 4, lt: 11, teeth: 1, low: 1, tongue: 0, round: 0, smile: 0 },
  I: { w: 64, o: 6, lt: 11, teeth: 1, low: 1, tongue: 0, round: 0, smile: 3 },
  E: { w: 52, o: 12, lt: 12, teeth: 1, low: 1, tongue: 1, round: 0, smile: 1 },
};

export const VOWEL_LIST = [
  { k: 'ㅏ', s: '아', p: 'A', cue: '입을 크게 아래로 벌려요' },
  { k: 'ㅑ', s: '야', p: 'A', glide: '이 → 아', cue: '‘이’ 입에서 ‘아’로 빠르게' },
  { k: 'ㅓ', s: '어', p: 'EO', cue: '힘을 빼고 중간만큼 벌려요' },
  { k: 'ㅕ', s: '여', p: 'EO', glide: '이 → 어', cue: '‘이’ 입에서 ‘어’로 빠르게' },
  { k: 'ㅗ', s: '오', p: 'O', cue: '동그랗게 앞으로 내밀어요' },
  { k: 'ㅛ', s: '요', p: 'O', glide: '이 → 오', cue: '‘이’ 입에서 ‘오’로 빠르게' },
  { k: 'ㅜ', s: '우', p: 'U', cue: '더 작고 뾰족하게 쭉' },
  { k: 'ㅠ', s: '유', p: 'U', glide: '이 → 우', cue: '‘이’ 입에서 ‘우’로 빠르게' },
  { k: 'ㅡ', s: '으', p: 'EU', cue: '옆으로 납작, 이를 거의 닫아요' },
  { k: 'ㅣ', s: '이', p: 'I', cue: '웃듯이 옆으로 당겨요' },
] as const;

export const SHAPE_OF: Record<string, keyof typeof SHAPES> = { ㅏ: 'A', ㅑ: 'A', ㅓ: 'EO', ㅕ: 'EO', ㅗ: 'O', ㅛ: 'O', ㅜ: 'U', ㅠ: 'U', ㅡ: 'EU', ㅣ: 'I', ㅔ: 'E', ㅐ: 'E', ㅖ: 'E', ㅒ: 'E', ㅚ: 'O', ㅟ: 'U', ㅘ: 'O', ㅝ: 'U', ㅙ: 'O', ㅞ: 'U', ㅢ: 'EU' };

const f = (n: number) => Math.round(n * 10) / 10;
function lip(p: LipParams) {
  const cx = 100, cy = 60, W = p.w, O = Math.max(0.6, p.o), L = p.lt, r = p.round || 0, cd = p.smile || 0;
  const M = (a: number, b: number) => b + (a - b) * r;
  const topY = cy - O * M(0.86, 0.56) - L;
  const botY = cy + O * M(0.86, 0.94) + L + 2;
  const k = M(1, 0.8);
  const midUp = cy - O * 0.5 - L * 0.8;
  const midLo = cy + O * 0.7 + L;
  const outer = `M${f(cx - W)} ${f(cy - cd)} C${f(cx - W * k)} ${f(midUp)} ${f(cx - W * 0.45)} ${f(topY - 2)} ${f(cx - W * 0.22)} ${f(topY - 3)} C${f(cx - W * 0.1)} ${f(topY - 3)} ${f(cx - W * 0.05)} ${f(topY + 2)} ${cx} ${f(topY + 3)} C${f(cx + W * 0.05)} ${f(topY + 2)} ${f(cx + W * 0.1)} ${f(topY - 3)} ${f(cx + W * 0.22)} ${f(topY - 3)} C${f(cx + W * 0.45)} ${f(topY - 2)} ${f(cx + W * k)} ${f(midUp)} ${f(cx + W)} ${f(cy - cd)} C${f(cx + W * k * 0.95)} ${f(midLo)} ${f(cx + W * 0.4)} ${f(botY)} ${cx} ${f(botY)} C${f(cx - W * 0.4)} ${f(botY)} ${f(cx - W * k * 0.95)} ${f(midLo)} ${f(cx - W)} ${f(cy - cd)} Z`;
  const iw = W * M(0.5, 0.8), ic = cy - cd * 0.6;
  const up = M(1.15, 0.75), dn = M(1.15, 1.25);
  const inner = `M${f(cx - iw)} ${f(ic)} C${f(cx - iw * 0.55)} ${f(cy - O * up)} ${f(cx + iw * 0.55)} ${f(cy - O * up)} ${f(cx + iw)} ${f(ic)} C${f(cx + iw * 0.6)} ${f(cy + O * dn)} ${f(cx - iw * 0.6)} ${f(cy + O * dn)} ${f(cx - iw)} ${f(ic)} Z`;
  const iTop = cy - O * up * 0.75, iBot = cy + O * dn * 0.75;
  const th = Math.min(9, (iBot - iTop) * 0.5) * (p.teeth || 0);
  const ty = iTop - 1;
  const lth = Math.min(6, (iBot - iTop) * 0.4) * (p.low || 0);
  const tl = th > 0.6 ? [-0.42, -0.14, 0.14, 0.42].map((d) => `M${f(cx + iw * d)} ${f(ty)} v${f(th)}`).join(' ') : 'M0 0';
  return {
    outer, inner, tx: f(cx - iw), tw: f(iw * 2), ty: f(ty), th: f(th), tLines: tl, lty: f(iBot - lth + 1), lth: f(lth),
    tgY: f(cy + O * 0.85), tgRx: f(iw * 0.62), tgRy: f(O * 0.45 * (p.tongue || 0)), shY: f(botY + 4), shRx: f(W * 0.55),
    glY: f(botY - L * 0.5), glRx: f(W * 0.3), guL: f(cx - W * 0.28), guR: f(cx + W * 0.28), guY: f(topY + L * 0.45), guRx: f(W * 0.12),
  };
}
const mix = (a: LipParams, b: LipParams, m: number) => Object.fromEntries(Object.keys(b).map((k) => [k, (a as any)[k] + ((b as any)[k] - (a as any)[k]) * m])) as LipParams;
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** 2.8초마다 쉬는 입 → 모음 입모양으로 움직이는 시간 (줄인 움직임 설정이면 멈춤) */
export function useMouthClock(enabled = true) {
  const [t, setT] = useState(0);
  const [on, setOn] = useState(enabled);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setOn(false);
  }, []);
  useEffect(() => {
    if (!on) return;
    const t0 = Date.now();
    const iv = setInterval(() => setT(((Date.now() - t0) % 2800) / 2800), 50);
    return () => clearInterval(iv);
  }, [on]);
  return { t, on, toggle: () => setOn((x) => !x) };
}

export function Mouth({ shape, glide, t, on, label, id }: { shape: keyof typeof SHAPES; glide?: boolean; t: number; on: boolean; label: string; id: string }) {
  const amt = !on ? 1 : t < 0.25 ? ease(t / 0.25) : t < 0.7 ? 1 : t < 0.92 ? 1 - ease((t - 0.7) / 0.22) : 0;
  const amtG = !on ? 1 : t < 0.18 ? 0 : t < 0.42 ? ease((t - 0.18) / 0.24) : t < 0.75 ? 1 : t < 0.95 ? 1 - ease((t - 0.75) / 0.2) : 0;
  const p = glide ? mix(SHAPES.I, SHAPES[shape], amtG) : mix(SHAPES.REST, SHAPES[shape], amt);
  const l = lip(p);
  return (
    <svg width="100%" viewBox="0 0 200 124" role="img" aria-label={label} className="block h-auto rounded-[14px]">
      <defs>
        <radialGradient id={`skin${id}`} cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#F8DACB" />
          <stop offset="100%" stopColor="#E6AF9A" />
        </radialGradient>
        <linearGradient id={`lipg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C2606A" />
          <stop offset="48%" stopColor="#A9434F" />
          <stop offset="100%" stopColor="#D4797F" />
        </linearGradient>
        <radialGradient id={`mouth${id}`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#6B2530" />
          <stop offset="100%" stopColor="#240A0F" />
        </radialGradient>
        <clipPath id={`lc${id}`}>
          <path d={l.inner} />
        </clipPath>
      </defs>
      <rect width="200" height="124" fill={`url(#skin${id})`} />
      <ellipse cx="100" cy={l.shY} rx={l.shRx} ry="5" fill="#C98E7B" opacity="0.45" />
      <path d={l.outer} fill={`url(#lipg${id})`} />
      <path d={l.outer} fill="none" stroke="#9C3B47" strokeWidth="0.8" opacity="0.6" />
      <path d={l.inner} fill={`url(#mouth${id})`} />
      <g clipPath={`url(#lc${id})`}>
        <ellipse cx="100" cy={l.tgY} rx={l.tgRx} ry={l.tgRy} fill="#C95A63" />
        <rect x={l.tx} y={l.ty} width={l.tw} height={l.th} rx="2" fill="#F6F1EA" />
        <path d={l.tLines} stroke="#D8CEC2" strokeWidth="1" />
        <rect x={l.tx} y={l.lty} width={l.tw} height={l.lth} rx="2" fill="#EDE6DC" />
      </g>
      <path d={l.inner} fill="none" stroke="#6E2630" strokeWidth="1.4" />
      <ellipse cx="100" cy={l.glY} rx={l.glRx} ry="2.8" fill="#FFFFFF" opacity="0.4" />
      <ellipse cx={l.guL} cy={l.guY} rx={l.guRx} ry="1.6" fill="#FFFFFF" opacity="0.28" />
      <ellipse cx={l.guR} cy={l.guY} rx={l.guRx} ry="1.6" fill="#FFFFFF" opacity="0.28" />
    </svg>
  );
}
