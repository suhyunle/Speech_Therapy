'use client';
import { useState, type ReactNode } from 'react';
import { Card, cx } from '@/components/ui';
import { Heard } from '@/features/record/Heard';
import { Analyzing, HissMeter, IssueBox, LiveBars, MicButton, OfflineBox, useAttemptFlow } from '@/features/record/RecordPanel';
import type { Attempt, AttemptContext } from '@/types/api';

/**
 * 한 문항 녹음 묶음: 녹음 → 분석 → (보여줄 때만) 들린 대로.
 * 기초선(Baseline)은 feedback=false 로 들린 대로를 숨긴다.
 */
export function RecordStage({
  text,
  itemId,
  context,
  soundSymbol,
  feedback = true,
  hiss = false,
  big = true,
  note,
  onDone,
  extra,
  maxMs,
}: {
  text: string;
  itemId?: string;
  context: AttemptContext;
  soundSymbol?: string;
  feedback?: boolean;
  hiss?: boolean;
  big?: boolean;
  note?: ReactNode;
  onDone: (a: Attempt) => void;
  extra?: (a: Attempt | null) => ReactNode;
  maxMs?: number;
}) {
  const [last, setLast] = useState<Attempt | null>(null);
  const flow = useAttemptFlow(
    { context, itemId, soundSymbol, text: itemId ? undefined : text, targetText: text },
    (a) => {
      if (a.status === 'DONE') {
        setLast(a);
        onDone(a);
      }
    },
    { maxMs },
  );
  const busy = flow.phase === 'uploading' || flow.phase === 'analyzing';
  const recording = flow.rec.state === 'recording';
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col items-center gap-2 rounded-[30px] px-5 py-6">
        <span className={cx('text-center font-jua leading-tight', big && text.length <= 4 ? 'text-[56px] tracking-[0.12em]' : 'text-[30px]')}>{text}</span>
        {note}
      </Card>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span>내 소리</span>
          <span className={recording ? 'text-coral-ink' : 'text-muted'}>{recording ? `녹음 중 ${(flow.rec.elapsed / 1000).toFixed(1)}초` : last ? '녹음했어요' : '아직 녹음 전'}</span>
        </div>
        <LiveBars history={flow.rec.history} active={recording} />
        {hiss && <HissMeter value={flow.rec.hiss} />}
        {feedback && last && (
          <div className="flex flex-col gap-0.5 rounded-2xl bg-ink px-4 py-3 text-white">
            <span className="text-[11px] font-bold text-[#C8C5DD]">들린 대로</span>
            <Heard target={text} heard={last.heard} className="font-jua text-[24px]" />
          </div>
        )}
        {extra?.(last)}
      </Card>
      {busy && <Analyzing />}
      {flow.phase === 'offline' && <OfflineBox />}
      {flow.phase === 'issue' && flow.issue && <IssueBox issue={flow.issue} onRetry={flow.reset} />}
      {flow.error && (
        <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-bold text-coral-ink">
          {flow.error}
        </p>
      )}
      {!busy && flow.phase !== 'issue' && (
        <div className="flex justify-center pt-1">
          <MicButton recording={recording} onClick={() => flow.toggle()} label={last && !recording ? '다시 녹음' : undefined} />
        </div>
      )}
    </div>
  );
}
