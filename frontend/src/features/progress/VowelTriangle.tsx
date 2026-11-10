'use client';
import { VOWEL_TARGETS } from '@/utils/lpc';

const KEYS = ['ㅣ', 'ㅏ', 'ㅜ'] as const;
const W = 300;
const H = 220;
const px = (f2: number) => W - 20 - ((f2 - 600) / 2400) * (W - 40);
const py = (f1: number) => 20 + ((f1 - 200) / 800) * (H - 40);

/** 디자인: VowelSpace · 목표(점선) · 처음(회색) · 지금(보라) 삼각형 */
export function VowelTriangle({ first, latest, set = 'f' }: { first: Record<string, [number, number]>; latest: Record<string, [number, number]>; set?: 'f' | 'm' }) {
  const target = VOWEL_TARGETS[set];
  const poly = (m: Record<string, [number, number]>) => (KEYS.every((k) => m[k]) ? KEYS.map((k) => `${px(m[k][1])},${py(m[k][0])}`).join(' ') : null);
  const t = poly(target);
  const a = poly(first);
  const b = poly(latest);
  return (
    <div className="flex flex-col gap-1.5">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-2xl bg-bg" role="img" aria-label="모음 삼각형: 목표, 처음, 지금">
        {t && <polygon points={t} fill="none" stroke="#C9C3FF" strokeWidth={3} strokeDasharray="7 6" />}
        {a && <polygon points={a} fill="rgba(142,139,168,0.18)" stroke="#8E8BA8" strokeWidth={3} />}
        {b && <polygon points={b} fill="rgba(91,75,255,0.18)" stroke="#5B4BFF" strokeWidth={3.5} />}
        {KEYS.map((k) => (
          <text key={k} x={px(target[k][1])} y={py(target[k][0]) + (k === 'ㅏ' ? 22 : -10)} textAnchor="middle" fontFamily="Jua" fontSize={18} fill="#1B1A33">
            {k}
          </text>
        ))}
        {b && a && KEYS.map((k) => latest[k] && <line key={k} x1={px(latest[k][1])} y1={py(latest[k][0])} x2={px(target[k][1])} y2={py(target[k][0])} stroke="#FF8A66" strokeWidth={2} strokeDasharray="3 4" />)}
      </svg>
      <span className="text-xs text-muted">┅ 목표 · 회색 = 처음 · 보라 = 지금 · 주황 점선 = 가야 할 방향</span>
    </div>
  );
}

/** 지금 위치와 목표를 비교해 모음별로 한 줄 */
export function vowelHints(latest: Record<string, [number, number]>, set: 'f' | 'm' = 'f') {
  const t = VOWEL_TARGETS[set];
  const out: { k: string; text: string }[] = [];
  const l = latest;
  if (l['ㅣ'] && l['ㅣ'][1] < t['ㅣ'][1] - 250) out.push({ k: 'ㅣ', text: '혀를 더 앞으로 · 웃듯이 옆으로' });
  if (l['ㅏ'] && l['ㅏ'][0] < t['ㅏ'][0] - 120) out.push({ k: 'ㅏ', text: '턱을 손가락 두 개만큼 더 내려요' });
  if (l['ㅜ'] && l['ㅜ'][1] > t['ㅜ'][1] + 250) out.push({ k: 'ㅜ', text: '입술을 더 동그랗게 내밀어요' });
  return out;
}
