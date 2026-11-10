'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell, BackHeader, Button, Card, Empty, ErrorState, Loading, cx } from '@/components/ui';
import { Analyzing, IssueBox, LiveBars, MicButton, OfflineBox, useAttemptFlow } from '@/features/record/RecordPanel';
import { ExerciseResult, compareLast } from '@/features/voice/ExerciseResult';
import { EXERCISE_META } from '@/features/voice/ExerciseViews';
import { errorText } from '@/services/api';
import { trainingApi, type ExerciseItem } from '@/services/endpoints';
import type { Attempt } from '@/types/api';

const ORDER = ['forward', 'endclear', 'intonation', 'timing'] as const;
const INTON_LABEL = { up: '묻는 말 ↗', down: '말하는 말 ↘' } as const;

function Run({ kind, item, onDone }: { kind: string; item: ExerciseItem; onDone: (a: Attempt) => void }) {
  const [res, setRes] = useState<Attempt | null>(null);
  const flow = useAttemptFlow({ context: 'EXERCISE', itemId: item.id, targetText: item.text }, (a) => {
    if (a.status === 'DONE') {
      setRes(a);
      onDone(a);
    }
  }, { maxMs: 10_000 });
  const busy = flow.phase === 'uploading' || flow.phase === 'analyzing';
  const recording = flow.rec.state === 'recording';
  const shown = res?.result ?? item.last?.result;
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col items-center gap-2 rounded-[30px] py-6">
        {item.intonation && <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">{INTON_LABEL[item.intonation]}</span>}
        <span className="text-center font-jua text-[36px] leading-tight">{item.text}</span>
        {item.note && <span className="text-sm text-sub">{item.note}</span>}
      </Card>
      <Card className="flex flex-col gap-3">
        <div className="flex justify-between text-xs font-bold">
          <span>{res ? '방금 잰 값' : item.last ? '지난 녹음' : '내 소리'}</span>
          <span className={recording ? 'text-coral-ink' : 'text-muted'}>{recording ? `녹음 중 ${(flow.rec.elapsed / 1000).toFixed(1)}초` : ''}</span>
        </div>
        {recording || !shown ? <LiveBars history={flow.rec.history} active={recording} /> : <ExerciseResult result={shown} text={item.text} pronunciation={item.pronunciation} />}
      </Card>
      {busy && <Analyzing />}
      {flow.phase === 'offline' && <OfflineBox />}
      {flow.phase === 'issue' && flow.issue && <IssueBox issue={flow.issue} onRetry={flow.reset} />}
      {flow.error && <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-bold text-coral-ink">{flow.error}</p>}
      {!busy && flow.phase !== 'issue' && (
        <div className="flex justify-center">
          <MicButton recording={recording} onClick={() => flow.toggle()} label={recording ? '다 말했으면 멈춤' : shown ? '다시 말하기' : `“${item.text}” 말하기`} />
        </div>
      )}
    </div>
  );
}

/** 디자인: VoiceForward · EndClear · Intonation · Timing */
export default function ExercisePage() {
  const kind = useParams<{ kind: string }>().kind;
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['exercises'], queryFn: trainingApi.exercises });
  const [idx, setIdx] = useState(0);
  const meta = EXERCISE_META[kind];
  if (!meta) return <Empty title="없는 연습이에요" action={<Button href="/voice">발성 · 억양으로</Button>} />;
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  const items = q.data[kind as keyof typeof q.data] ?? [];
  if (!items.length) return <Empty title="연습 문항이 아직 없어요" action={<Button href="/voice">돌아가기</Button>} />;
  const item = items[Math.min(idx, items.length - 1)];
  const nextKind = ORDER[ORDER.indexOf(kind as (typeof ORDER)[number]) + 1];
  const better = compareLast(kind, item.last?.result, item.previous?.result);
  return (
    <AppShell tabs={false} wide>
      <BackHeader title={meta.short} href="/voice" right={<span className="text-xs font-bold text-muted">{items.length}단계</span>} />
      <div className="flex flex-col gap-1 px-6 pt-2">
        <h1 className="font-jua text-[26px]">{meta.title}</h1>
        <p className="text-sm leading-relaxed text-sub">{meta.desc}</p>
      </div>
      <div className="flex flex-col gap-4 px-5 pt-4 lg:grid lg:grid-cols-[300px_1fr] lg:items-start">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-muted">오늘의 단계</span>
          <div className="flex gap-2 overflow-x-auto lg:flex-col">
            {items.map((it, i) => (
              <button key={it.id} type="button" onClick={() => setIdx(i)} aria-current={i === idx} className={cx('flex shrink-0 items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left', i === idx ? 'bg-brand text-white shadow-btn' : 'bg-white shadow-chip')}>
                <span className="font-jua text-lg">{it.text}</span>
                {it.last && <span className={cx('text-xs font-bold', i === idx ? 'text-white' : 'text-pass-text')}>✓</span>}
              </button>
            ))}
          </div>
          <Card className="hidden flex-col gap-2 lg:flex">
            <b className="text-sm">이렇게 해봐요</b>
            <ol className="flex flex-col gap-1.5 text-sm text-sub">
              {meta.tips.map((t, i) => (
                <li key={t}>
                  {i + 1}. {t}
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="flex flex-col gap-3 pb-8">
          {better && <span className="self-start rounded-full bg-lime px-3 py-1.5 text-[13px] font-bold text-lime-ink">{better}</span>}
          <Run key={item.id} kind={kind} item={item} onDone={() => void qc.invalidateQueries({ queryKey: ['plan'] })} />
          <Card className="flex flex-col gap-1.5 lg:hidden">
            <b className="text-sm">이렇게 해봐요</b>
            {meta.tips.map((t, i) => (
              <span key={t} className="text-sm text-sub">
                {i + 1}. {t}
              </span>
            ))}
          </Card>
          <div className="grid grid-cols-2 gap-2">
            {idx < items.length - 1 ? (
              <Button variant="outline" onClick={() => setIdx(idx + 1)}>
                다음 단계
              </Button>
            ) : (
              <Button variant="outline" href="/voice">
                발성 목록
              </Button>
            )}
            {nextKind ? <Button onClick={() => (setIdx(0), router.push(`/voice/${nextKind}`))}>다음 연습 →</Button> : <Button href="/home">오늘 학습으로</Button>}
          </div>
          <span className="text-center text-xs text-muted">{kind === 'forward' ? '거리와 울림 위치는 내 첫 녹음과 비교한 값이에요' : '모두 소리 자체를 재서 바로 보여줘요 · 점수는 매기지 않아요'}</span>
        </div>
      </div>
    </AppShell>
  );
}
