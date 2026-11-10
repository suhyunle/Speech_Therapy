'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AppShell, BackHeader, Button, Card, Empty, ErrorState, Loading, cx } from '@/components/ui';
import { RecordStage } from '@/features/record/RecordStage';
import { errorText } from '@/services/api';
import { trainingApi } from '@/services/endpoints';

const VERDICT = { better: ['나아졌어요', 'bg-pass-soft text-pass-ink'], same: ['비슷해요', 'bg-tint text-sub'], worse: ['다시 연습해요', 'bg-coral-soft text-coral-ink'] } as const;

/** 디자인: WeeklyCheck · 기초선과 같은 단어로만 비교 (들린 대로 기준) */
export default function WeeklyPage() {
  const symbol = decodeURIComponent(useParams<{ symbol: string }>().symbol);
  const q = useQuery({ queryKey: ['weekly', symbol], queryFn: () => trainingApi.weekly(symbol) });
  const qc = useQueryClient();
  const [pick, setPick] = useState<string | null>(null);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  const w = q.data;
  if (!w.baselineDoneAt)
    return (
      <AppShell tabs={false}>
        <BackHeader title="일주일 체크" />
        <Empty title={`${symbol} 기초선이 아직 없어요`} desc="새 소리를 배우기 전에 남긴 녹음과 비교해야 해서, 기초선부터 남겨요." action={<Button href={`/baseline/${encodeURIComponent(symbol)}`}>기초선 남기기</Button>} />
      </AppShell>
    );
  const todo = w.rows.filter((r) => !r.recordedNow);
  const current = w.rows.find((r) => r.itemId === pick) ?? todo[0];
  const doneCount = w.rows.length - todo.length;
  const finished = todo.length === 0;
  return (
    <AppShell tabs={false} wide>
      <BackHeader title={`일주일 체크 · ${symbol}`} progress={doneCount / Math.max(1, w.rows.length)} right={<span className="text-xs font-bold text-muted">{doneCount}/{w.rows.length} 녹음</span>} />
      <div className="flex flex-col gap-1 px-6 pt-2">
        <h1 className="font-jua text-[26px] leading-tight">
          {finished ? (
            <>
              일주일 전 그 단어,
              <br />
              {w.rows.length}개 중 {w.improved}개가 또렷해졌어요
            </>
          ) : (
            <>
              일주일 전 그 단어,
              <br />
              다시 말해 볼까요?
            </>
          )}
        </h1>
        <p className="text-xs text-muted">연습 전에 남긴 기초선과 같은 단어로만 비교해요 · 들린 대로 기준</p>
      </div>
      <div className="flex flex-col gap-4 px-5 pt-4 lg:grid lg:grid-cols-[1fr_1fr] lg:items-start">
        <div className="flex flex-col gap-2">
          {w.rows.map((r) => (
            <Card key={r.itemId} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <b className="font-jua text-[22px]">{r.text}</b>
                {r.recordedNow && r.verdict ? <span className={cx('rounded-full px-2.5 py-1 text-xs font-bold', VERDICT[r.verdict][1])}>{VERDICT[r.verdict][0]}</span> : <span className="text-xs text-muted">아직 녹음 전</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-bg px-3 py-2">
                  <span className="block text-[11px] font-bold text-muted">기초선</span>
                  <b className="font-jua text-lg">{r.baselineHeard ?? '—'}</b>
                </div>
                <div className="rounded-xl bg-ink px-3 py-2 text-white">
                  <span className="block text-[11px] font-bold text-[#C8C5DD]">지금</span>
                  <b className="font-jua text-lg">{r.recordedNow ? (r.nowHeard ?? '들린 소리 없음') : '—'}</b>
                </div>
              </div>
              {!finished && r.itemId !== current?.itemId && (
                <button type="button" onClick={() => setPick(r.itemId)} className="self-start text-xs font-bold text-brand-dark">
                  {r.recordedNow ? '다시 녹음하기' : '이 단어 녹음하기'} ›
                </button>
              )}
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-3 pb-8">
          {current && !finished && (
            <RecordStage
              key={current.itemId}
              text={current.text}
              itemId={current.itemId}
              context="WEEKLY"
              soundSymbol={symbol}
              onDone={() => {
                setPick(null);
                void q.refetch();
                void qc.invalidateQueries({ queryKey: ['plan'] });
              }}
            />
          )}
          {finished && (
            <>
              <Card className="flex items-center justify-between gap-3">
                <span className="text-sm leading-relaxed">
                  <b>사람 귀로도 확인할까요?</b>
                  <br />
                  같은 {w.rows.length}개를 보내면, 앱 말고 사람도 알아듣는지 알 수 있어요.
                </span>
                <Button href={`/share?sound=${encodeURIComponent(symbol)}&context=WEEKLY`} variant="outline" className="w-auto shrink-0 px-4">
                  보내기
                </Button>
              </Card>
              <Button href="/progress">{w.improved > 0 ? `일주일 만에 단어 ${w.improved}개가 바뀌었어요! 성장 기록 보기` : '성장 기록 보기'}</Button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
