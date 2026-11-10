'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppShell, Button, Card, Chip, Empty, ErrorState, Loading, cx } from '@/components/ui';
import { Heard } from '@/features/record/Heard';
import { errorText } from '@/services/api';
import { attemptsApi, progressApi } from '@/services/endpoints';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

/** 디자인: Records · 내 녹음 · 처음과 지금 / Progress · 성장 기록 / EmptyRecords */
export default function RecordsPage() {
  const sum = useQuery({ queryKey: ['progress'], queryFn: progressApi.summary });
  const list = useQuery({ queryKey: ['attempts'], queryFn: () => attemptsApi.list(undefined, 20) });
  return (
    <AppShell>
      <header className="px-6 pt-[max(env(safe-area-inset-top),24px)] md:pt-6">
        <h1 className="font-jua text-[28px]">내 녹음</h1>
        {sum.data && <span className="text-sm text-sub">녹음 {sum.data.totalRecordings}개</span>}
      </header>
      {(sum.isLoading || list.isLoading) && <Loading />}
      {sum.error && <ErrorState message={errorText(sum.error)} onRetry={() => sum.refetch()} />}
      {sum.data && sum.data.totalRecordings === 0 && <Empty title="아직 녹음이 없어요" desc="첫 녹음을 하면 여기에 처음 소리가 남아요. 나중에 지금 소리와 나란히 비교해요." action={<Button href="/home" className="mt-2 max-w-[240px]">첫 소리 녹음하기</Button>} />}
      {sum.data && sum.data.totalRecordings > 0 && (
        <div className="flex flex-col gap-3 px-5 pb-6 pt-4">
          {sum.data.sounds
            .filter((s) => s.first)
            .slice(0, 3)
            .map((s) => (
              <Card key={s.symbol} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-jua text-[20px]">
                    {s.symbol} · {s.latest ? '처음과 지금' : '첫 녹음'}
                  </span>
                  {s.latest?.passed && !s.first?.passed && <Chip tone="pass">나아졌어요!</Chip>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[s.first, s.latest].map((x, i) =>
                    x ? (
                      <Link key={x.id} href={`/result/${x.id}`} className="flex flex-col gap-1 rounded-2xl bg-bg p-3">
                        <span className="text-[11px] font-bold text-muted">
                          {i === 0 ? '처음' : '지금'} · {new Date(x.at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                        </span>
                        <Heard target={x.target} heard={x.heard} className="font-jua text-[24px]" />
                        <span className="text-[11px] text-sub">정답 {x.target}</span>
                      </Link>
                    ) : (
                      <span key={i} className="flex items-center justify-center rounded-2xl border-2 border-dashed border-line2 p-3 text-xs text-muted">
                        다음 녹음과 비교해요
                      </span>
                    ),
                  )}
                </div>
                {s.first?.hiss?.hissSec !== undefined && s.latest?.hiss?.hissSec !== undefined && s.latest && (
                  <span className="text-[13px] leading-relaxed text-sub">
                    바람 소리가 {s.first.hiss.hissSec}초 → <b className="text-coral-ink">{s.latest.hiss.hissSec}초</b>로 {s.latest.hiss.hissSec > s.first.hiss.hissSec ? '길어졌어요' : '바뀌었어요'}.
                  </span>
                )}
              </Card>
            ))}
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <b>이번 주 녹음 {sum.data.thisWeek}번</b>
              <span className="text-xs font-bold text-pass-text">{sum.data.thisWeek - sum.data.lastWeek >= 0 ? `지난주보다 +${sum.data.thisWeek - sum.data.lastWeek}` : `지난주 ${sum.data.lastWeek}번`}</span>
            </div>
            <div className="grid h-24 grid-cols-7 items-end gap-2">
              {sum.data.week.map((d, i) => {
                const max = Math.max(1, ...sum.data.week.map((w) => w.count));
                return (
                  <div key={d.date} className="flex h-full flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-bold text-sub">{d.count || ''}</span>
                    <span className="w-full rounded-lg bg-brand" style={{ height: `${(d.count / max) * 70}%`, minHeight: d.count ? 6 : 2, opacity: d.count ? 1 : 0.2 }} />
                    <span className="text-[11px] text-muted">{DAYS[i]}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          {sum.data.placement.first?.pcc && (
            <Card className="flex flex-col gap-1.5">
              <b className="text-sm">성장 기록 · 맞게 낸 개수 (같은 진단 단어로만 비교)</b>
              <span className="text-[15px]">
                처음 진단: 자음 {sum.data.placement.first.pcc.total}개 중 <b>{sum.data.placement.first.pcc.correct}개</b>
                {sum.data.placement.latest?.pcc && (
                  <>
                    {' '}→ 지금: <b className="text-pass-text">{sum.data.placement.latest.pcc.correct}개</b>
                  </>
                )}
              </span>
              {!sum.data.placement.latest && <span className="text-xs text-muted">진단을 다시 하면 처음과 비교해요 (설정 → 진단 다시 하기)</span>}
            </Card>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" href="/soundmap">
              소리 지도
            </Button>
            <Button variant="outline" href="/share">
              사람 귀 확인
            </Button>
          </div>
          <b className="pt-2 text-sm">최근 녹음</b>
          <ul className="flex flex-col gap-2">
            {list.data?.map((a) => (
              <li key={a.id}>
                <Link href={`/result/${a.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-chip">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-bold">{a.targetText}</span>
                    <span className="truncate text-xs text-muted">들린 대로 {a.heard ?? (a.issue ? '녹음 문제' : '—')}</span>
                  </span>
                  <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-bold', a.status !== 'DONE' ? 'bg-bg text-muted' : a.passed ? 'bg-pass-soft text-pass-ink' : 'bg-coral-soft text-coral-ink')}>
                    {a.status === 'QUEUED' || a.status === 'PROCESSING' ? '분석 중' : a.status === 'ISSUE' ? '다시 녹음' : a.status === 'FAILED' ? '분석 실패' : a.passed ? '소리 통과' : '연습 중'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
