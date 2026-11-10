'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AppShell, BackHeader, Button, Card, ErrorState, Loading } from '@/components/ui';
import { HissKHzMeter } from '@/features/record/HissKHzMeter';
import { Analyzing, IssueBox, MicButton, OfflineBox, useAttemptFlow } from '@/features/record/RecordPanel';
import { errorText } from '@/services/api';
import { trainingApi } from '@/services/endpoints';
import type { Attempt } from '@/types/api';

/** 디자인: SMeter · “스—” 길게 내면서 점을 초록 칸에 넣어요 */
export default function SMeterPage() {
  const q = useQuery({ queryKey: ['exercises'], queryFn: trainingApi.exercises });
  const qc = useQueryClient();
  const [res, setRes] = useState<Attempt | null>(null);
  const item = q.data?.hiss?.[0];
  const flow = useAttemptFlow({ context: 'EXERCISE', itemId: item?.id, soundSymbol: 'ㅅ', targetText: item?.text ?? '스—' }, (a) => {
    if (a.status === 'DONE') {
      setRes(a);
      void qc.invalidateQueries({ queryKey: ['exercises'] });
    }
  }, { maxMs: 8000 });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  const recording = flow.rec.state === 'recording';
  const busy = flow.phase === 'uploading' || flow.phase === 'analyzing';
  const last = res?.result?.measures?.hiss ?? item?.last?.result?.measures?.hiss ?? null;
  const prev = res ? item?.last?.result?.measures?.hiss : item?.previous?.result?.measures?.hiss;
  const up = last?.centroidKHz != null && prev?.centroidKHz != null ? Math.round((last.centroidKHz - prev.centroidKHz) * 10) / 10 : null;
  const k = flow.rec.hissKHz;
  return (
    <AppShell tabs={false}>
      <BackHeader title="ㅅ 쉬익 미터" right={<span className="text-xs font-bold text-muted">{recording ? '실시간 듣고 있어요' : ''}</span>} />
      <div className="flex flex-col gap-1 px-6 pt-2">
        <h1 className="font-jua text-[26px] leading-tight">
          “스—” 길게 내면서
          <br />
          점을 초록 칸에 넣어요
        </h1>
      </div>
      <div className="flex flex-col gap-3 px-5 pt-8">
        <Card className="pt-8">
          <HissKHzMeter khz={recording ? k : (last?.centroidKHz ?? null)} strength={recording ? flow.rec.hiss : last ? 1 : 0} listening={recording} />
        </Card>
        {((recording && k != null && k < 5) || (!recording && last?.centroidKHz != null && last.centroidKHz < 5)) && (
          <Card className="bg-coral-soft text-sm leading-relaxed shadow-none">
            <b>점이 왼쪽(3~4)에 머물면</b>
            <br />
            혀가 입천장에 넓게 닿아서 ‘쉬’처럼 나요. 혀끝만 윗니 뒤에 대고, 좁은 틈으로 바람을 보내요.
          </Card>
        )}
        {!recording && last && (
          <Card className="flex justify-between text-sm">
            <span>
              방금 녹음 · 중심 <b>{last.centroidKHz ?? '—'} kHz</b>
            </span>
            <span>
              바람 유지 <b>{last.hissSec}초</b>
            </span>
          </Card>
        )}
        {up != null && up > 0.2 && <span className="self-start rounded-full bg-lime px-3 py-1.5 text-[13px] font-bold text-lime-ink">지난번보다 중심이 {up} kHz 올라갔어요!</span>}
        {busy && <Analyzing />}
        {flow.phase === 'offline' && <OfflineBox />}
        {flow.phase === 'issue' && flow.issue && <IssueBox issue={flow.issue} onRetry={flow.reset} />}
        {flow.error && <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-bold text-coral-ink">{flow.error}</p>}
        <p className="text-xs leading-relaxed text-muted">녹음에서 4 kHz 위 소리 에너지와 그 중심을 바로 계산해요. AI 판정 없이 소리 자체를 보여줘요. 저장되는 값은 서버에서 다시 잰 값이에요.</p>
      </div>
      <div className="mt-auto flex flex-col items-center gap-3 px-5 pb-8 pt-5">
        {!busy && flow.phase !== 'issue' && <MicButton recording={recording} onClick={() => flow.toggle()} label={recording ? '멈추기' : '“스—” 길게 내기'} />}
        <Button href="/learn/%E3%85%85" variant="outline">
          멈추고 단어로 해보기
        </Button>
      </div>
    </AppShell>
  );
}
