'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppShell, BackHeader, Button, Card, Empty, ErrorState, Loading, cx } from '@/components/ui';
import { RecordStage } from '@/features/record/RecordStage';
import { errorText } from '@/services/api';
import { trainingApi } from '@/services/endpoints';

const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return d <= 0 ? '오늘' : d < 14 ? `${d}일 전` : `${Math.floor(d / 7)}주 전`;
};

/** 디자인: Review · 복습 가볍게 3개 */
export default function ReviewPage() {
  const q = useQuery({ queryKey: ['review'], queryFn: trainingApi.review });
  const qc = useQueryClient();
  const [idx, setIdx] = useState(0);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  useEffect(() => {
    if (q.data) {
      const first = q.data.findIndex((r) => !r.done);
      setIdx(first < 0 ? 0 : first);
    }
  }, [q.data]);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  const list = q.data ?? [];
  if (!list.length)
    return (
      <AppShell tabs={false}>
        <BackHeader title="복습" href="/home" />
        <Empty title="아직 복습할 소리가 없어요" desc="소리를 하나 배우거나 진단에서 클리어하면 여기서 가끔 다시 확인해요." action={<Button href="/home">홈으로</Button>} />
      </AppShell>
    );
  const cur = list[idx];
  const isDone = (id: string) => doneIds.includes(id) || list.find((r) => r.item.id === id)?.done;
  const allDone = list.every((r) => isDone(r.item.id));
  return (
    <AppShell tabs={false} wide>
      <BackHeader title={`복습 · 가볍게 ${list.length}개`} progress={list.filter((r) => isDone(r.item.id)).length / list.length} href="/home" />
      <div className="flex flex-col gap-1 px-6 pt-2">
        <h1 className="font-jua text-[26px]">배운 소리, 다시 꺼내 봐요</h1>
        <p className="text-sm text-sub">쉬는 동안 흐려져도 괜찮아요. 금방 돌아와요</p>
      </div>
      <div className="flex flex-col gap-4 px-5 pt-4 lg:grid lg:grid-cols-[320px_1fr] lg:items-start">
        <div className="flex flex-col gap-2">
          {list.map((r, i) => (
            <button
              key={r.symbol}
              type="button"
              onClick={() => setIdx(i)}
              aria-current={i === idx}
              className={cx('flex items-center gap-3 rounded-2xl p-3 text-left', i === idx ? 'bg-brand-soft ring-2 ring-brand' : 'bg-white shadow-chip')}
            >
              <span className={cx('flex h-11 w-11 items-center justify-center rounded-xl font-jua text-[24px]', isDone(r.item.id) ? 'bg-pass text-white' : 'bg-bg text-ink')}>{r.symbol}</span>
              <span className="flex flex-col">
                <b className="text-sm">
                  {r.symbol} · {r.state === 'ALREADY_GOOD' ? '이미 잘하는 소리' : r.manner}
                </b>
                <span className="text-xs text-muted">
                  {r.state === 'ALREADY_GOOD' ? '가끔 확인해요' : `${ago(r.lastAt)}에 배웠어요`}
                  {i === idx ? ' · 지금' : ''}
                  {isDone(r.item.id) ? ' · 했어요' : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-[13px] font-bold text-brand-dark">이 단어를 읽어요</span>
          <RecordStage
            key={cur.item.id}
            text={cur.item.text}
            itemId={cur.item.id}
            context="REVIEW"
            soundSymbol={cur.symbol}
            hiss={cur.symbol === 'ㅅ' || cur.symbol === 'ㅆ'}
            note={cur.tip && <span className="text-center text-sm text-sub">{cur.tip}</span>}
            onDone={() => {
              setDoneIds((d) => [...d, cur.item.id]);
              void qc.invalidateQueries({ queryKey: ['plan'] });
            }}
          />
          <div className="flex flex-col gap-2 pb-8 pt-2">
            {idx < list.length - 1 ? (
              <Button onClick={() => setIdx(idx + 1)} disabled={!isDone(cur.item.id)}>
                다음 소리
              </Button>
            ) : (
              <Button href="/home" disabled={!allDone}>
                복습 끝! 오늘 연습으로
              </Button>
            )}
            {!isDone(cur.item.id) && <span className="text-center text-xs text-muted">녹음해야 다음으로 넘어가요</span>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
