'use client';
import { VOWEL_TARGETS } from '@/utils/lpc';

/**
 * 모음 지도: 가로 F2(앞↔뒤, 왼쪽이 앞), 세로 F1(위가 입 작게).
 * 목표 칸은 성인 평균 위치(대략) 둘레. 점수 없이 위치만 보여준다.
 */
const F2 = [600, 3000];
const F1 = [200, 1000];
const W = 320;
const H = 220;
const px = (f2: number) => W - ((f2 - F2[0]) / (F2[1] - F2[0])) * W;
const py = (f1: number) => ((f1 - F1[0]) / (F1[1] - F1[0])) * H;
const clampX = (v: number) => Math.max(8, Math.min(W - 8, v));
const clampY = (v: number) => Math.max(8, Math.min(H - 8, v));

export function VowelMap({
  set = 'f',
  target,
  live,
  trail = [],
  point,
  compare,
  label = '내 모음',
  targets,
}: {
  set?: 'f' | 'm';
  target?: string | null;
  live?: { f1: number; f2: number } | null;
  trail?: { f1: number; f2: number }[];
  point?: { f1: number; f2: number } | null;
  compare?: string | null;
  label?: string;
  /** 서버가 준 목표 칸 (내 목소리에 맞춘 값이 있으면 그것) */
  targets?: Record<string, [number, number]>;
}) {
  const t = targets ?? VOWEL_TARGETS[set];
  const shown = live ?? point ?? null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-2xl bg-bg" role="img" aria-label={`${label}: ${target ? `목표 ${target}` : ''} ${shown ? '점이 찍혔어요' : '아직 점이 없어요'}`}>
      {Object.entries(t).map(([k, [f1, f2]]) => {
        const on = k === target;
        const cmp = k === compare;
        return (
          <g key={k}>
            <ellipse cx={px(f2)} cy={py(f1)} rx={on ? 34 : 22} ry={on ? 26 : 17} fill={on ? '#C9F0DF' : cmp ? '#FFE1D6' : '#fff'} stroke={on ? '#14A06E' : cmp ? '#FF6B3D' : '#E6E3F2'} strokeWidth={on ? 3 : 2} strokeDasharray={on ? '0' : '5 4'} />
            <text x={px(f2)} y={py(f1) + 6} textAnchor="middle" fontSize={on ? 18 : 15} fontFamily="Jua" fill={on ? '#0B4F33' : '#8E8BA8'}>
              {k}
            </text>
          </g>
        );
      })}
      {trail.length > 1 && <polyline points={trail.map((p) => `${clampX(px(p.f2))},${clampY(py(p.f1))}`).join(' ')} fill="none" stroke="#7F72FF" strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" />}
      {shown && <circle cx={clampX(px(shown.f2))} cy={clampY(py(shown.f1))} r={10} fill="#5B4BFF" stroke="#fff" strokeWidth={4} />}
      <text x={6} y={H - 6} fontSize={10} fill="#8E8BA8">
        혀 뒤 ← → 혀 앞
      </text>
      <text x={W - 6} y={14} fontSize={10} fill="#8E8BA8" textAnchor="end">
        입 작게 ↑
      </text>
    </svg>
  );
}
