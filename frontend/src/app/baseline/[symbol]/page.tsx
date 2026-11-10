'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { AppShell, BackHeader, Button, Card, Empty, ErrorState, Loading, cx } from '@/components/ui';
import { RecordStage } from '@/features/record/RecordStage';
import { errorText } from '@/services/api';
import { trainingApi } from '@/services/endpoints';

/** 디자인: Baseline · 새 소리를 배우기 전에 지금 소리를 3번 남긴다 (피드백 없음) */
export default function BaselinePage() {
  const symbol = decodeURIComponent(useParams<{ symbol: string }>().symbol);
  const q = useQuery({ queryKey: ['baseline', symbol], queryFn: () => trainingApi.baseline(symbol) });
  const qc = useQueryClient();
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  const b = q.data;
  const learn = `/learn/${encodeURIComponent(symbol)}`;
  if (!b.items.length)
    return (
      <AppShell tabs={false}>
        <BackHeader title="기초선 녹음" />
        <Empty title={`${symbol} 기초선 단어가 아직 없어요`} desc="바로 배우기로 넘어가요." action={<Button href={learn}>{symbol} 배우기</Button>} />
      </AppShell>
    );
  const total = b.items.length * b.repeat;
  const recorded = b.items.reduce((n, i) => n + i.count, 0);
  const next = b.next;
  return (
    <AppShell tabs={false}>
      <BackHeader title={`새 소리 ${symbol} · 시작 전 기록`} progress={recorded / total} right={<span className="text-xs font-bold text-muted">연습 전</span>} />
      <div className="flex flex-col gap-1 px-6 pt-2">
        <h1 className="font-jua text-[26px] leading-tight">
          배우기 전에
          <br />
          지금 소리를 {b.repeat}번씩 남겨요
        </h1>
        <p className="text-sm leading-relaxed text-sub">연습 뒤 같은 단어로 다시 녹음해서, 달라진 것만 비교해요.</p>
      </div>
      <div className="flex gap-2 px-5 pt-3">
        {b.items.map((i) => (
          <Card key={i.id} className={cx('flex flex-1 flex-col items-center gap-1 py-3', next?.id === i.id && 'ring-2 ring-brand')}>
            <b className="font-jua text-lg">{i.text}</b>
            <span className="flex gap-1" aria-label={`${b.repeat}번 중 ${i.count}번 녹음`}>
              {Array.from({ length: b.repeat }, (_, k) => (
                <span key={k} className={cx('h-2 w-2 rounded-full', k < i.count ? 'bg-brand' : 'bg-line2')} />
              ))}
            </span>
          </Card>
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-5 pt-3">
        {next && !b.done ? (
          <>
            <RecordStage
              key={`${next.id}-${next.count}`}
              text={next.text}
              itemId={next.id}
              context="BASELINE"
              soundSymbol={symbol}
              feedback={false}
              note={<span className="text-sm font-bold text-brand-dark">{b.repeat}번 중 {next.count}번 녹음했어요</span>}
              onDone={() => {
                void q.refetch();
                void qc.invalidateQueries({ queryKey: ['plan'] });
              }}
            />
            <p className="rounded-2xl bg-white px-4 py-3 text-xs leading-relaxed text-muted shadow-chip">지금은 피드백을 보여주지 않아요. 기준을 그대로 남기려고 그래요. 잘하든 못하든 괜찮아요.</p>
          </>
        ) : (
          <Card className="flex flex-col items-center gap-2 bg-pass-soft py-8 text-center">
            <b className="font-jua text-[24px] text-pass-ink">기초선을 다 남겼어요!</b>
            <span className="text-sm text-pass-ink">일주일 뒤 같은 단어로 다시 녹음해서 비교해 드릴게요.</span>
          </Card>
        )}
      </div>
      <div className="flex flex-col gap-2 px-5 pb-8 pt-4">
        {b.done || !next ? <Button href={learn}>바로 {symbol} 배우기</Button> : <span className="text-center text-xs text-muted">{total - recorded === 1 ? `하나만 더! 그다음 바로 ${symbol} 배우기예요` : `${total - recorded}번 남았어요`}</span>}
      </div>
    </AppShell>
  );
}
