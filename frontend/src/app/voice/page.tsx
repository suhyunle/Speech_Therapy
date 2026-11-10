'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppShell, Button, Card, ErrorState, Loading } from '@/components/ui';
import { ExerciseResult, compareLast } from '@/features/voice/ExerciseResult';
import { EXERCISE_META } from '@/features/voice/ExerciseViews';
import { errorText } from '@/services/api';
import { trainingApi } from '@/services/endpoints';

const ORDER = ['forward', 'endclear', 'intonation', 'timing'] as const;

/** 디자인: WebVoice · 목소리를 앞으로, 끝까지, 자연스럽게 */
export default function VoicePage() {
  const q = useQuery({ queryKey: ['exercises'], queryFn: trainingApi.exercises });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  const d = q.data;
  const cheer = ORDER.map((k) => d[k].map((it) => compareLast(k, it.last?.result, it.previous?.result)).find(Boolean)).find(Boolean);
  return (
    <AppShell wide>
      <div className="flex flex-col gap-1 px-6 pt-10 lg:px-0 lg:pt-4">
        <h1 className="font-jua text-[28px] lg:text-[34px]">목소리를 앞으로, 끝까지, 자연스럽게</h1>
        <p className="text-sm leading-relaxed text-sub lg:text-base">1분 준비운동 → 끝소리 → 억양 → 길이 순서로 해요. 모두 소리 자체를 재서 바로 보여줘요.</p>
        {cheer && <span className="mt-2 self-start rounded-full bg-lime px-3 py-1.5 text-[13px] font-bold text-lime-ink">{cheer}</span>}
      </div>
      <div className="grid gap-4 px-5 pb-10 pt-4 lg:grid-cols-2 lg:px-0">
        {ORDER.map((k) => {
          const m = EXERCISE_META[k];
          const items = d[k];
          const withLast = items.find((i) => i.last);
          return (
            <Card key={k} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <b className="text-[17px]">
                  {m.n} · {m.title}
                </b>
                <span className="text-xs text-muted">
                  {items.filter((i) => i.last).length}/{items.length} 해봤어요
                </span>
              </div>
              <p className="text-sm leading-relaxed text-sub">{m.desc}</p>
              {withLast ? (
                <div className="rounded-2xl bg-bg p-3">
                  <span className="mb-2 block font-jua text-lg">{withLast.text}</span>
                  <ExerciseResult result={withLast.last!.result} text={withLast.text} pronunciation={withLast.pronunciation} compact />
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {items.map((i) => (
                    <span key={i.id} className="rounded-xl bg-brand-soft px-3 py-1.5 font-jua text-brand-dark">
                      {i.text}
                    </span>
                  ))}
                </div>
              )}
              <Button href={`/voice/${k}`} variant={withLast ? 'outline' : 'primary'}>
                {withLast ? '다시 말하기' : '시작하기'}
              </Button>
            </Card>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 px-5 pb-10 lg:px-0">
        <Link href="/smeter" className="rounded-2xl bg-white p-4 text-sm font-bold shadow-chip">
          ㅅ 쉬익 미터 · 바람 길게 내기 ›
        </Link>
        <Link href="/home" className="text-center text-sm font-bold text-brand-dark">
          오늘 학습으로 지금 말해보기 ›
        </Link>
      </div>
    </AppShell>
  );
}
