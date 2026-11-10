'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell, BackHeader, Button, Card, ErrorState, Loading } from '@/components/ui';
import { RetentionPicker, Toggle } from '@/features/settings/Toggle';
import { errorText } from '@/services/api';
import { accountApi, meApi } from '@/services/endpoints';

/** 디자인: VoiceModel · 내 목소리에 맞추기 */
export default function VoiceModelPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['voice-model'], queryFn: accountApi.voiceModel });
  const set = useMutation({ mutationFn: accountApi.setVoiceModel, onSuccess: (d) => qc.setQueryData(['voice-model'], d) });
  const ret = useMutation({ mutationFn: (v: number) => meApi.updateSettings({ retentionDays: v }), onSuccess: () => (q.refetch(), qc.invalidateQueries({ queryKey: ['settings'] })) });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  const v = q.data;
  const left = Math.max(0, v.goal - v.recordings);
  const cal = v.calibration as { vowels?: Record<string, [number, number]> | null; recordings?: number; at?: string } | null;
  return (
    <AppShell tabs={false}>
      <BackHeader title="내 목소리에 맞추기" href="/settings" />
      <div className="flex flex-col gap-1 px-6 pt-2">
        <span className="text-sm font-bold text-brand-dark">
          {Math.min(v.recordings, v.goal)} / {v.goal}개
        </span>
        <div className="h-3 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (v.recordings / v.goal) * 100)}%` }} />
        </div>
        <h1 className="mt-2 whitespace-pre-line font-jua text-[26px] leading-tight">{left > 0 ? `${left}개만 더 모으면\n내 말에 맞춰요` : '내 말에 맞출 만큼 모였어요'}</h1>
        <p className="text-sm leading-relaxed text-sub">내가 맞게 낸 모음 녹음의 위치를 모아서, 모음 지도의 목표 칸을 내 목소리에 맞춰요.</p>
      </div>
      <div className="flex flex-col gap-3 px-5 pt-4">
        <Card>
          <Toggle label="내 녹음으로 맞추기" desc="기본은 꺼져 있어요" on={v.enabled} onChange={(e) => set.mutate(e)} disabled={set.isPending} />
        </Card>
        <Card className="flex flex-col gap-2 text-sm">
          <span>
            <b>쓰는 것</b> · 내 녹음에서 잰 값과 그때 읽은 글자
          </span>
          <span>
            <b>만드는 것</b> · 내 계정에서만 쓰는 기준값
          </span>
          <span>
            <b>끄면</b> · 맞춘 기준값을 바로 지워요
          </span>
          {cal?.at && (
            <span className="text-xs text-muted">
              {new Date(cal.at).toLocaleDateString('ko-KR')} 맞춤 · {cal.vowels ? `모음 ${Object.keys(cal.vowels).join('·')} 칸을 내 목소리로 옮겼어요` : '아직 모음마다 3번 이상 맞게 낸 녹음이 없어 목표 칸은 그대로예요'}
            </span>
          )}
        </Card>
        <Card>
          <RetentionPicker value={v.retentionDays} onChange={(x) => ret.mutate(x)} />
        </Card>
        <p className="text-xs leading-relaxed text-muted">목소리는 개인정보예요. 다른 사람이나 다른 모델 학습에는 쓰지 않아요. 지금은 받아쓰기(인식) 모델 자체를 다시 가르치지는 않고, 모음 목표 칸만 내 목소리에 맞춰요. 20개 녹음마다 다시 맞춰요.</p>
        {set.error && <p className="text-sm text-coral-ink">{errorText(set.error)}</p>}
      </div>
      <div className="mt-auto flex flex-col gap-2 px-5 pb-8 pt-5">
        {!v.enabled ? (
          <>
            <Button onClick={() => set.mutate(true)} disabled={set.isPending}>
              동의하고 켜기
            </Button>
            <Button variant="ghost" href="/settings">
              지금은 안 할게요
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => set.mutate(false)} disabled={set.isPending}>
            끄고 맞춘 기준 지우기
          </Button>
        )}
      </div>
    </AppShell>
  );
}
