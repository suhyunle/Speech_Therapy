'use client';
import { cx } from '@/components/ui';
import type { AnalysisResult } from '@/types/api';

type Ex = NonNullable<AnalysisResult['exercise']>;

export const EXERCISE_META: Record<string, { n: number; title: string; short: string; desc: string; tips: string[] }> = {
  forward: {
    n: 1,
    title: '목소리 앞으로 보내기',
    short: '발성 · 목소리 앞으로',
    desc: '소리가 목 안에 머물면 먹힌 소리처럼 들려요. 입술 앞에서 “음—마” 하고 울림을 느껴요.',
    tips: ['입술을 가볍게 다물고 “음—”', '입술이 간질간질 떨리면 소리가 앞으로 나온 거예요'],
  },
  endclear: {
    n: 2,
    title: '끝소리 먹지 않기',
    short: '발성 · 끝소리까지 또렷하게',
    desc: '끝으로 갈수록 소리가 작아지면 마지막 글자가 안 들려요.',
    tips: ['숨을 들이쉬고, 마지막 글자까지 쓸 숨을 남겨요', '마지막 글자에서 입을 크게 벌리고 앞으로 던지듯'],
  },
  intonation: {
    n: 3,
    title: '묻는 말 끝 올리기',
    short: '억양 · 묻는 말 끝 올리기',
    desc: '묻는 말은 끝을 계단 하나 올려요. 내 평소 목소리 높이를 기준으로 높고 낮음만 비교해요.',
    tips: ['마지막 글자에서 목을 살짝 들고', '질문하듯 끝을 올려요'],
  },
  timing: {
    n: 4,
    title: '길게 끌지 않기',
    short: '길이 · 속도 · 짧게 끊기',
    desc: '모음을 길게 끌면 말이 늘어져 보여요. 글자마다 길이를 맞춰요.',
    tips: ['글자 하나에 박자 하나', '빠르게 말할 때도 글자 길이를 고르게'],
  },
};

/** 글자마다 소리 크기 (EndClear) */
export function SyllableLoudness({ ex }: { ex: Ex }) {
  const s = ex.syllables;
  if (!s.length) return null;
  const max = Math.max(...s.map((x) => x.db));
  const min = Math.min(...s.map((x) => x.db), max - 30);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-bold">글자마다 소리 크기</span>
      <div className="relative flex h-24 items-end gap-1.5" role="img" aria-label={`글자 ${s.length}개 크기, 작아진 글자 ${ex.weak?.length ?? 0}개`}>
        {s.map((x, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className={cx('w-full rounded-t-lg', ex.weak?.includes(i) ? 'bg-coral' : 'bg-brand')} style={{ height: `${Math.max(8, ((x.db - min) / Math.max(1, max - min)) * 72)}px` }} />
            <span className="font-jua text-sm">{x.text ?? '·'}</span>
          </div>
        ))}
      </div>
      {!ex.aligned && <span className="text-[11px] text-muted">글자 수가 정확히 나뉘지 않아 글자 이름 없이 보여요</span>}
    </div>
  );
}

/** 높낮이 곡선: 기준(점선) vs 내 목소리(실선). 기준은 원하는 끝 모양만 그린 안내선 */
export function PitchCurve({ ex, text }: { ex: Ex; text: string }) {
  const c = (ex.contourSt ?? []).filter((v) => Number.isFinite(v));
  const W = 300;
  const H = 110;
  const lo = Math.min(-4, ...c);
  const hi = Math.max(6, ...c);
  const y = (v: number) => H - 10 - ((v - lo) / (hi - lo)) * (H - 20);
  const pts = c.map((v, i) => `${(i / Math.max(1, c.length - 1)) * W},${y(v)}`).join(' ');
  const want = ex.want === 'up' ? `0,${y(0)} ${W * 0.7},${y(0)} ${W},${y(4)}` : `0,${y(0)} ${W * 0.7},${y(0)} ${W},${y(-3)}`;
  return (
    <div className="flex flex-col gap-1.5">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`끝 높이 변화 ${ex.finalSlopeSt ?? '알 수 없음'} 반음`}>
        <polyline points={want} fill="none" stroke="#C9C3FF" strokeWidth={4} strokeDasharray="8 7" strokeLinecap="round" />
        {pts && <polyline points={pts} fill="none" stroke="#5B4BFF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
      <div className="flex justify-between text-xs text-muted">
        <span>┅ 기준 목소리 ━ 내 목소리</span>
        <span className="font-jua text-base text-ink">{text}</span>
      </div>
    </div>
  );
}

/** 글자 길이 비교 (Timing) */
export function SyllableTiming({ ex, texts }: { ex: Ex; texts: string[] }) {
  const ref = ex.refSylSec ?? 0.22;
  const s = ex.syllables;
  const total = Math.max(ex.totalSec ?? 0, ex.refTotalSec ?? 0, 0.5);
  const Row = ({ label, items }: { label: string; items: { t: string; dur: number; long?: boolean }[] }) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold text-muted">{label}</span>
      <div className="flex gap-1">
        {items.map((x, i) => (
          <span key={i} className={cx('flex h-9 items-center justify-center rounded-lg font-jua text-sm', x.long ? 'bg-coral text-white' : 'bg-brand-soft text-brand-dark')} style={{ width: `${(x.dur / total) * 100}%`, minWidth: 22 }}>
            {x.t}
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <Row label={`기준 · ${ex.refTotalSec ?? '—'}초`} items={texts.map((t) => ({ t, dur: ref }))} />
      <Row label={`내 말 · ${ex.totalSec ?? '—'}초`} items={s.map((x, i) => ({ t: x.text ?? '·', dur: x.dur, long: ex.long?.includes(i) }))} />
    </div>
  );
}

export function RateBar({ rate }: { rate: number | null | undefined }) {
  if (rate == null) return null;
  const zone = rate < 3.5 ? 0 : rate <= 5.5 ? 1 : 2;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-sub">
        빠르기 초당 <b>{rate}</b> 글자 · 보통은 4~5
      </span>
      <div className="grid grid-cols-3 gap-1 text-center text-xs font-bold">
        {['천천히', '보통', '빠르게'].map((l, i) => (
          <span key={l} className={cx('rounded-lg py-1.5', i === zone ? 'bg-brand text-white' : 'bg-tint text-muted')}>
            {l}
            {i === zone ? ' · 지금' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 울림이 머무는 곳 (VoiceForward): 목 안 ↔ 입술 앞, 처음 기준 목소리와 비교 */
export function ForwardMeter({ ex }: { ex: Ex }) {
  const pos = ex.position;
  return (
    <div className="flex flex-col gap-3">
      {ex.distanceRatio != null && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold">소리가 닿는 거리 · 처음 녹음 대비</span>
          <div className="relative h-3 rounded-full bg-line">
            <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${Math.min(100, ex.distanceRatio * 50)}%` }} />
            <span className="absolute -top-1 h-5 w-0.5 bg-ink" style={{ left: '50%' }} />
          </div>
          <span className="text-xs text-sub">
            처음보다 {ex.distanceRatio >= 1 ? `${ex.distanceRatio}배 멀리` : `${Math.round((1 - ex.distanceRatio) * 100)}% 덜 멀리`} 닿아요 ({ex.loudDeltaDb! > 0 ? '+' : ''}
            {ex.loudDeltaDb}dB)
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold">울림이 머무는 곳 {pos == null ? '' : pos >= 0.6 ? '· 앞으로 잘 나왔어요' : pos >= 0.45 ? '· 처음과 비슷해요' : '· 조금 뒤쪽이에요'}</span>
        <div className="relative h-8 rounded-full bg-line">
          <span className="absolute inset-y-0 right-0 w-[40%] rounded-r-full bg-pass-range" />
          {pos != null && <span className="absolute top-1 h-6 w-6 -translate-x-1/2 rounded-full border-4 border-white bg-brand shadow" style={{ left: `${pos * 100}%` }} />}
        </div>
        <div className="flex justify-between text-[11px] text-muted">
          <span>목 안</span>
          <span>입술 앞 · 목표</span>
        </div>
        {pos == null && <span className="text-xs text-coral-ink">처음 기준 목소리가 없어서 비교하지 못했어요. 마이크 확인(아——)을 먼저 해 주세요.</span>}
      </div>
      {ex.holdSec != null && <span className="text-xs text-sub">이어서 낸 길이 {ex.holdSec}초</span>}
    </div>
  );
}

/** 결과 한 줄 문장 (점수 없이, 잰 값으로만) */
export function exerciseMessage(ex: Ex, texts: string[]): { good: string | null; fix: string | null } {
  if (ex.kind === 'endclear') {
    const w = (ex.weak ?? []).map((i) => ex.syllables[i]?.text).filter(Boolean);
    if (ex.ok) return { good: '마지막 글자까지 또렷했어요!', fix: null };
    const front = ex.syllables.length ? `${ex.syllables.slice(0, 2).map((s) => s.text ?? '').join('')}` : '';
    return {
      good: front && !(ex.weak ?? []).includes(0) ? '앞부분은 또렷했어요!' : null,
      fix: ex.missingTail ? '끝 글자가 거의 들리지 않았어요. 마지막 글자까지 숨을 남겨요' : w.length ? `‘${w.join('')}’에서 소리가 작아졌어요. 끝을 한 번 더 밀어요` : '끝으로 갈수록 소리가 작아졌어요',
    };
  }
  if (ex.kind === 'intonation') {
    const last = texts[texts.length - 1] ?? '';
    if (ex.intonationOk == null) return { good: null, fix: '목소리 높이를 잡지 못했어요. 조금 더 크게 다시 말해요' };
    if (ex.intonationOk) return { good: ex.want === 'up' ? `‘${last}’에서 끝이 잘 올라갔어요!` : '끝을 차분히 잘 내렸어요!', fix: null };
    return { good: null, fix: ex.want === 'up' ? `‘${last}’에서 거의 그대로예요. 마지막 글자에서 질문하듯 올려요` : '끝이 올라갔어요. 말하는 말은 끝을 내려요' };
  }
  if (ex.kind === 'timing') {
    const long = (ex.long ?? []).map((i) => ex.syllables[i]?.text ?? `${i + 1}번째 글자`);
    const okOnes = ex.aligned ? ex.syllables.filter((_, i) => !(ex.long ?? []).includes(i)).map((s) => `‘${s.text}’`) : [];
    return {
      good: long.length === 0 ? '글자 길이가 고르게 맞았어요!' : okOnes.length ? `${okOnes.join(' ')}는 기준 길이와 같았어요!` : null,
      fix: long.length ? `‘${long.join('’ ‘')}’가 길게 끌려요` : null,
    };
  }
  if (ex.kind === 'forward') {
    if (ex.position == null) return { good: null, fix: null };
    return ex.ok ? { good: '울림이 입술 앞으로 잘 나왔어요!', fix: null } : { good: null, fix: '입술 앞이 간질간질하게, “음—”을 앞으로 보내요' };
  }
  return { good: null, fix: null };
}
