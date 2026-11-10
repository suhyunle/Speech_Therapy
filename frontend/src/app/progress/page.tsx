'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell, Button, Card, Empty, ErrorState, Loading, cx } from '@/components/ui';
import { HissDots } from '@/features/progress/HissDots';
import { VowelTriangle } from '@/features/progress/VowelTriangle';
import { errorText } from '@/services/api';
import { downloadExport } from '@/features/progress/export';
import { attemptsApi, planApi, progressApi } from '@/services/endpoints';

function Bar({ label, total, a, b }: { label: string; total: number; a: number; b: number | null }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span>
          {total}개 중 <b>{a}</b>
          {b != null && (
            <>
              {' '}→ <b className="text-brand">{b}</b>
            </>
          )}
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-line">
        {b != null && <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${(b / Math.max(1, total)) * 100}%` }} />}
        <span className="absolute inset-y-0 left-0 rounded-full bg-faint" style={{ width: `${(Math.min(a, b ?? a) / Math.max(1, total)) * 100}%` }} />
      </div>
    </div>
  );
}

/** 디자인: Progress · WebRecords · 점수가 아니라 맞게 낸 개수예요 */
export default function ProgressPage() {
  const s = useQuery({ queryKey: ['progress'], queryFn: progressApi.summary });
  const plan = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  const recent = useQuery({ queryKey: ['attempts', 'recent'], queryFn: () => attemptsApi.list(undefined, 6) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (s.isLoading) return <Loading />;
  if (s.error || !s.data) return <ErrorState message={errorText(s.error)} onRetry={() => s.refetch()} />;
  const d = s.data;
  const pf = d.placement.first;
  const pl = d.placement.latest && d.placement.sessions > 1 ? d.placement.latest : null;
  const exp = async () => {
    setBusy(true);
    setErr(null);
    try {
      await downloadExport(false);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (d.totalRecordings === 0)
    return (
      <AppShell>
        <Empty title="아직 기록이 없어요" desc="첫 녹음을 하면 여기에 처음 소리가 남아요. 같은 목록으로 다시 녹음해서 맞게 낸 개수를 세요." action={<Button href="/home">첫 소리 녹음하기</Button>} />
      </AppShell>
    );
  return (
    <AppShell wide>
      <div className="flex flex-col gap-1 px-6 pt-10 lg:flex-row lg:items-end lg:justify-between lg:px-0 lg:pt-4">
        <div>
          <span className="text-[13px] font-bold text-brand-dark">성장 기록{d.daysSinceFirst != null ? ` · 첫 진단부터 ${d.daysSinceFirst}일` : ''}</span>
          <h1 className="font-jua text-[28px] leading-tight lg:text-[32px]">{d.wordsImproved ? `단어 ${d.wordsImproved}개를 더 또렷하게` : '점수가 아니라 맞게 낸 개수예요'}</h1>
          <p className="text-sm text-sub">점수가 아니라 같은 목록으로 다시 녹음해서 맞게 낸 개수를 세요.</p>
        </div>
        <Button variant="outline" onClick={exp} disabled={busy} className="mt-2 w-auto shrink-0 self-start px-5 lg:self-end">
          {busy ? '만드는 중…' : '기록 내보내기'}
        </Button>
      </div>
      {err && <p className="px-6 text-sm text-coral-ink">{err}</p>}
      <div className="grid gap-4 px-5 pb-10 pt-4 lg:grid-cols-2 lg:px-0">
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <b className="text-sm">처음과 지금</b>
            {pf?.pcc ? <Bar label="자음 맞게 낸 수" total={pf.pcc.total} a={pf.pcc.correct} b={pl?.pcc?.correct ?? null} /> : <span className="text-sm text-muted">첫 진단 기록이 없어요</span>}
            {pf?.pwc && <Bar label="단어 전체 맞게 낸 수" total={pf.pwc.total} a={pf.pwc.correct} b={pl?.pwc?.correct ?? null} />}
            {d.vowels.areaIndex != null && (
              <div className="flex justify-between text-sm">
                <span>모음 삼각형 넓이</span>
                <span>
                  처음을 100으로 · 100 → <b className="text-brand">{d.vowels.areaIndex}</b>
                </span>
              </div>
            )}
            <span className="text-xs text-muted">회색 = 첫 진단 · 보라 = 지금 · 같은 단어 목록으로 다시 녹음해 세요</span>
            {!pl && (
              <Link href="/placement" className="text-xs font-bold text-brand-dark">
                진단을 다시 하면 처음과 비교해요 ›
              </Link>
            )}
          </Card>
          <Card className="flex flex-col gap-2">
            <b className="text-sm">ㅅ · 기초선 vs 연습 후 바람 중심 높이</b>
            <HissDots baseline={d.hissS.baseline} after={d.hissS.after} />
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2">
            <div className="flex justify-between">
              <b className="text-sm">내 모음 삼각형</b>
              {d.vowels.areaIndex != null && <b className={cx('text-sm', d.vowels.areaIndex >= 100 ? 'text-pass-text' : 'text-coral-ink')}>{d.vowels.areaIndex >= 100 ? '+' : ''}{d.vowels.areaIndex - 100}%</b>}
            </div>
            {Object.keys(d.vowels.latest).length >= 3 ? (
              <VowelTriangle first={d.vowels.first} latest={d.vowels.latest} set={plan.data?.vowelSet} />
            ) : (
              <span className="text-sm text-muted">ㅣ·ㅏ·ㅜ가 들어간 단어를 녹음하면 삼각형이 그려져요.</span>
            )}
            <Link href="/progress/vowels" className="text-sm font-bold text-brand-dark">
              내 모음 지도 보기 ›
            </Link>
          </Card>
          <Card className="flex flex-col gap-2">
            <div className="flex justify-between">
              <b className="text-sm">최근 녹음</b>
              <Link href="/records" className="text-xs font-bold text-brand-dark">
                전체 ›
              </Link>
            </div>
            {recent.data?.map((a) => {
              const ch = a.result?.phonemes?.ops.find((o) => o.type === 'sub' && o.target && o.got);
              return (
                <Link key={a.id} href={`/result/${a.id}`} className="flex items-center justify-between rounded-xl bg-bg px-3 py-2.5 text-sm">
                  <span>
                    <b>{a.targetText}</b>
                    <span className="text-xs text-muted"> · 들린 대로 {a.heard ?? '—'}</span>
                  </span>
                  <span className={cx('text-xs font-bold', ch ? 'text-coral-ink' : a.passed ? 'text-pass-text' : 'text-muted')}>{ch ? `${ch.target!.symbol} 바뀜` : a.passed ? '통과' : a.status === 'DONE' ? '연습 중' : '녹음 문제'}</span>
                </Link>
              );
            })}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
