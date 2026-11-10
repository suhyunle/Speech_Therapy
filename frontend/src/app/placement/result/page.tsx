'use client';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppShell, Button, Card, Empty, Loading, cx } from '@/components/ui';
import { placementApi } from '@/services/endpoints';
import type { PlacementSummary } from '@/types/api';
import { isConsonant } from '@/utils/hangul';

function Dots({ v }: { v: PlacementSummary['perSound'][string] | undefined }) {
  const vals = [v?.syllable, v?.word, v?.sentence];
  return (
    <span className="flex gap-0.5" aria-label="글자 · 단어 · 문장">
      {vals.map((x, i) => (
        <span key={i} className={cx('h-1.5 w-1.5 rounded-full', x === true ? 'bg-pass' : x === false ? 'bg-coral' : 'bg-line2')} />
      ))}
    </span>
  );
}

function SoundTile({ s, tone, v }: { s: string; tone: 'pass' | 'practice' | 'unknown'; v?: PlacementSummary['perSound'][string] }) {
  return (
    <span className={cx('flex h-[58px] w-[52px] flex-col items-center justify-center gap-1 rounded-2xl font-jua text-[24px]', tone === 'pass' ? 'bg-pass text-white shadow-pass' : tone === 'practice' ? 'bg-white text-ink shadow-chip' : 'bg-tint text-muted')}>
      {s}
      <Dots v={v} />
    </span>
  );
}

/** 디자인: PlacementResult · 이미 좋은 소리는 초록으로 클리어 */
export default function PlacementResultPage() {
  const [local, setLocal] = useState<PlacementSummary | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem('malang-placement');
    if (raw) setLocal(JSON.parse(raw));
  }, []);
  const latest = useQuery({ queryKey: ['placement-latest'], queryFn: placementApi.latest, enabled: !local });
  const s = local ?? latest.data?.summary ?? null;
  if (!s && latest.isLoading) return <Loading />;
  if (!s) return <Empty title="아직 진단 결과가 없어요" action={<Button href="/placement">진단하기</Button>} />;

  const cons = (xs: string[]) => xs.filter(isConsonant);
  const vows = (xs: string[]) => xs.filter((x) => !isConsonant(x));
  const practice = [...s.practice, ...s.unknown];

  const sc = (s as any).stageCounts as Record<string, { ok: number; total: number }> | undefined;
  const firsts = practice.slice(0, 4);
  return (
    <AppShell tabs={false} wide>
      <div className="flex flex-col gap-1.5 px-6 pt-12 lg:pt-6">
        <span className="text-[13px] font-bold text-brand-dark">진단 끝 · 답한 문항 {s.answered}개</span>
        {s.cleared.length > 0 ? (
          <h1 className="font-jua text-[30px] leading-tight">
            {s.cleared.length}개 소리는
            <br />
            <span className="text-pass">이미 발음이 좋아요!</span>
          </h1>
        ) : (
          <h1 className="font-jua text-[28px] leading-tight">처음부터 하나씩 같이 연습해요</h1>
        )}
      </div>
      <div className="flex flex-col gap-3 px-5 pt-4 lg:grid lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex flex-col gap-3">
        {s.cleared.length > 0 && (
          <Card className="flex flex-col gap-3 bg-pass-soft shadow-[0_5px_0_#C9F0DF]">
            <div className="flex justify-between text-sm font-bold text-pass-ink">
              <span>클리어했어요</span>
              <span className="text-xs">글자·단어·문장 모두 통과</span>
            </div>
            {[['자음', cons(s.cleared)], ['모음', vows(s.cleared)]].map(([label, xs]) =>
              (xs as string[]).length ? (
                <div key={label as string} className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-pass-ink">{label}</span>
                  <div className="flex flex-wrap gap-2">{(xs as string[]).map((x) => <SoundTile key={x} s={x} tone="pass" v={s.perSound[x]} />)}</div>
                </div>
              ) : null,
            )}
          </Card>
        )}
        <Card className="flex flex-col gap-3">
          <div className="flex justify-between text-sm font-bold">
            <span>연습할 소리 {practice.length}개</span>
            <span className="flex items-center gap-2 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-pass" />통과
              <span className="h-1.5 w-1.5 rounded-full bg-coral" />연습
            </span>
          </div>
          {[['자음', cons(practice)], ['모음', vows(practice)]].map(([label, xs]) =>
            (xs as string[]).length ? (
              <div key={label as string} className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-sub">
                  {label} {(xs as string[]).length}
                </span>
                <div className="flex flex-wrap gap-2">{(xs as string[]).map((x) => <SoundTile key={x} s={x} tone={s.practice.includes(x) ? 'practice' : 'unknown'} v={s.perSound[x]} />)}</div>
              </div>
            ) : null,
          )}
          <span className="text-[11px] leading-relaxed text-muted">점 3개 = 글자 · 단어 · 문장. 회색 칸은 진단에서 한 단계만 나왔거나 확실하지 않아서 연습하며 다시 봐요.</span>
        </Card>
        </div>
        <aside className="flex flex-col gap-3">
          {sc && (
            <Card className="flex flex-col gap-2">
              <b className="text-sm">단계별 · 맞게 낸 개수</b>
              {[['syllable', '1단계 · 글자'], ['word', '2단계 · 단어'], ['sentence', '3단계 · 문장']].map(([k, t]) =>
                sc[k] ? (
                  <div key={k} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm"><span>{t}</span><b>{sc[k].ok} / {sc[k].total}</b></div>
                    <div className="h-2.5 rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${(sc[k].ok / Math.max(1, sc[k].total)) * 100}%` }} /></div>
                  </div>
                ) : null,
              )}
              <span className="text-xs text-muted">점수 대신 센 개수만 보여드려요.</span>
            </Card>
          )}
          {firsts.length > 0 && (
            <Card className="flex flex-col gap-2">
              <b className="text-sm">가장 먼저 할 것</b>
              <div className="flex flex-wrap gap-2">{firsts.map((x) => <span key={x} className="rounded-xl bg-brand-soft px-3 py-1.5 font-jua text-lg text-brand-dark">{x}</span>)}</div>
              <span className="text-xs text-muted">모음이 알아듣기에 가장 크게 영향을 줘서 먼저 해요.</span>
            </Card>
          )}
        </aside>
        {s.pcc && (
          <p className="text-center text-xs text-muted">
            단어 단계 자음 {s.pcc.total}개 중 {s.pcc.correct}개 맞게 들렸어요{s.pwc ? ` · 단어 ${s.pwc.total}개 중 ${s.pwc.correct}개` : ''}
          </p>
        )}
      </div>
      <div className="mt-auto px-5 pb-8 pt-5 lg:max-w-[420px]">
        <Button href="/order">학습 시작하기</Button>
      </div>
    </AppShell>
  );
}
