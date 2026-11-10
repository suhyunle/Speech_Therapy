'use client';
import { Card } from '@/components/ui';
import { ForwardMeter, PitchCurve, RateBar, SyllableLoudness, SyllableTiming, exerciseMessage } from '@/features/voice/ExerciseViews';
import type { AnalysisResult } from '@/types/api';

export const sylTexts = (pron: string) => Array.from(pron.replace(/[\s.?!,—-]/g, ''));

/** 발성 연습 한 번의 결과: 잰 값 그림 + 잘한 것 먼저 + 바꿀 것 하나 */
export function ExerciseResult({ result, text, pronunciation, compact }: { result: AnalysisResult | null | undefined; text: string; pronunciation: string; compact?: boolean }) {
  const ex = result?.exercise;
  if (!ex) return <span className="text-sm text-muted">아직 잰 값이 없어요</span>;
  const texts = sylTexts(pronunciation);
  const msg = exerciseMessage(ex, texts);
  return (
    <div className="flex flex-col gap-3">
      {ex.kind === 'endclear' && <SyllableLoudness ex={ex} />}
      {ex.kind === 'intonation' && <PitchCurve ex={ex} text={text} />}
      {ex.kind === 'timing' && (
        <>
          <SyllableTiming ex={ex} texts={texts} />
          {!compact && <RateBar rate={ex.rate} />}
        </>
      )}
      {ex.kind === 'forward' && <ForwardMeter ex={ex} />}
      {msg.good && <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">{msg.good}</span>}
      {msg.fix && <Card className="bg-coral-soft py-3 text-sm leading-relaxed text-coral-ink shadow-none">{msg.fix}</Card>}
    </div>
  );
}

/** 지난 번과 비교 (같은 문항, 같은 잣대) */
export function compareLast(kind: string, last: AnalysisResult | null | undefined, prev: AnalysisResult | null | undefined): string | null {
  const a = last?.exercise;
  const b = prev?.exercise;
  if (!a || !b) return null;
  if (kind === 'endclear' && a.tailDrop != null && b.tailDrop != null) {
    const d = Math.round((b.tailDrop - a.tailDrop) * 10) / 10;
    return d > 0.5 ? `지난번보다 끝소리가 ${d}dB 더 살았어요!` : null;
  }
  if (kind === 'timing' && a.totalSec != null && b.totalSec != null) {
    const d = Math.round((b.totalSec - a.totalSec) * 10) / 10;
    return d > 0.1 ? `지난번보다 ${d}초 덜 끌었어요!` : null;
  }
  if (kind === 'intonation' && a.finalSlopeSt != null && b.finalSlopeSt != null && a.want === 'up') {
    const d = Math.round((a.finalSlopeSt - b.finalSlopeSt) * 10) / 10;
    return d > 0.5 ? `지난번보다 끝이 ${d}반음 더 올라갔어요!` : null;
  }
  if (kind === 'forward' && a.position != null && b.position != null) {
    return a.position - b.position > 0.05 ? '지난번보다 울림이 앞으로 나왔어요!' : null;
  }
  return null;
}
