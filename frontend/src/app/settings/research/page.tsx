'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AppShell, BackHeader, Button, Card, ErrorState, Loading } from '@/components/ui';
import { downloadExport } from '@/features/progress/export';
import { Toggle } from '@/features/settings/Toggle';
import { errorText } from '@/services/api';
import { meApi } from '@/services/endpoints';
import type { Settings } from '@/types/api';

/** 디자인: ResearchMode · 내 연습 기록을 연구 자료로 받아요 */
export default function ResearchPage() {
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ['settings'], queryFn: meApi.settings });
  const c = useQuery({ queryKey: ['consents'], queryFn: meApi.consents });
  const save = useMutation({ mutationFn: (b: Partial<Settings>) => meApi.updateSettings(b), onSuccess: (d) => qc.setQueryData(['settings'], d) });
  const consent = useMutation({ mutationFn: (g: boolean) => meApi.consent('RESEARCH', g), onSuccess: () => c.refetch() });
  const [irb, setIrb] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (s.isLoading) return <Loading />;
  if (s.error || !s.data) return <ErrorState message={errorText(s.error)} onRetry={() => s.refetch()} />;
  const d = s.data;
  const exp = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (irb !== null && irb !== (d.irbNumber ?? '')) await save.mutateAsync({ irbNumber: irb || null });
      await downloadExport(d.researchAudio);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AppShell tabs={false}>
      <BackHeader title="연구 모드 · 내 기록 내보내기" href="/settings" />
      <div className="px-6 pt-2">
        <h1 className="font-jua text-[26px] leading-tight">
          내 연습 기록을
          <br />
          연구 자료로 받아요
        </h1>
      </div>
      <div className="flex flex-col gap-3 px-5 pt-4">
        <Card className="flex flex-col">
          <Toggle label="연구 모드" desc="기초선 녹음 · 연습 일기 켜기" on={d.researchMode} onChange={(v) => save.mutate({ researchMode: v })} />
          <Toggle label="녹음 원본 포함" desc="파일이 커지고, 목소리가 들어가요" on={d.researchAudio} onChange={(v) => save.mutate({ researchAudio: v })} />
        </Card>
        <Card className="flex flex-col gap-1.5 text-sm">
          <b>내보낼 것 · CSV</b>
          <span className="text-sub">녹음 목록 · 목표 글자 · 날짜 · 앱이 들은 것 · 소리별 비교 · 측정값</span>
          <span className="text-sub">사람 받아쓰기 결과 · 듣는 사람 경험</span>
          <span className="text-sub">연습 일기 · 동의 기록</span>
          <span className="pt-1 text-xs text-muted">기간 · 첫 진단부터 오늘까지</span>
        </Card>
        <Card className="flex flex-col gap-2">
          <Toggle label="연구 동의 기록" desc={c.data?.RESEARCH?.granted ? `${new Date(c.data.RESEARCH.at).toLocaleDateString('ko-KR')} 동의함` : '연구에 쓰려면 동의가 필요해요'} on={!!c.data?.RESEARCH?.granted} onChange={(g) => consent.mutate(g)} />
          <label className="flex flex-col gap-1 text-sm font-bold">
            심의 번호 (있으면)
            <input value={irb ?? d.irbNumber ?? ''} onChange={(e) => setIrb(e.target.value)} maxLength={60} className="min-h-[48px] rounded-[14px] border-2 border-line px-3.5 font-normal outline-none focus:border-brand" />
          </label>
          <span className="text-xs text-muted">다른 사람이 듣는 받아쓰기는 그 사람의 동의도 필요해요.</span>
        </Card>
        {err && <p className="text-sm font-bold text-coral-ink">{err}</p>}
      </div>
      <div className="mt-auto px-5 pb-8 pt-5">
        <Button onClick={exp} disabled={busy}>
          {busy ? '파일 만드는 중…' : '내보내기 파일 만들기'}
        </Button>
      </div>
    </AppShell>
  );
}
