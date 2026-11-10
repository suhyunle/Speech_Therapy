'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell, BackHeader, Button, Card, ErrorState, Loading, cx } from '@/components/ui';
import { errorText } from '@/services/api';
import { scriptsApi } from '@/services/endpoints';

type W = { text: string; core: string; status: 'ok' | 'changed' | 'skipped'; heard: string | null; t: number | null; sent: number; slide: number };
type S = { slide: number; text: string; words: number[]; clear: boolean; endDrop: boolean; extras: string[] };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const dur = (s: number) => `${Math.floor(s / 60) ? `${Math.floor(s / 60)}분 ` : ''}${Math.round(s % 60)}초`;

/** 디자인: MyScriptResult · WebScriptResult · 원고에 맞춰 본 내 말 */
export default function ScriptRunPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['script-run', id], queryFn: () => scriptsApi.run(id), refetchInterval: (x) => (x.state.data && ['QUEUED', 'PROCESSING'].includes(x.state.data.status) ? 2000 : false) });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  const run = q.data;
  const back = `/script`;
  if (run.status === 'QUEUED' || run.status === 'PROCESSING')
    return (
      <AppShell tabs={false}>
        <BackHeader title="내 글로 연습 · 결과" href={back} />
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="status">
          <b className="font-jua text-[24px]">원고와 내 말을 맞춰보고 있어요</b>
          <span className="text-sm text-sub">길게 읽었으면 1~2분 걸릴 수 있어요. 이 화면을 닫아도 계속 분석해요.</span>
          <div className="h-3 w-full max-w-[320px] overflow-hidden rounded-full bg-line">
            <div className="animate-bar h-full rounded-full bg-brand" />
          </div>
        </div>
      </AppShell>
    );
  if (run.status === 'FAILED' || !run.result) return <ErrorState message={run.error ?? '분석하다 문제가 생겼어요. 다시 녹음해 주세요'} />;
  const r = run.result as {
    durationSec: number;
    sentences: S[];
    words: W[];
    clearSentences: number;
    totalSentences: number;
    substitutions: { pair: string; count: number }[];
    endDrops: number;
    rateWindows: { t: number; rate: number | null }[];
    fasterFromSec: number | null;
    goodSounds: string[];
    practiceWords: string[];
    freeSpeech: boolean;
  };
  const top = r.substitutions[0];
  const finished = r.words.length > 0 && r.words.slice(-3).some((w) => w.status !== 'skipped');
  const slidesShown = [...new Set(r.sentences.map((s) => s.slide))];
  const maxRate = Math.max(1, ...r.rateWindows.map((w) => w.rate ?? 0));
  const practiceHref = r.practiceWords[0] ? `/practice/custom?text=${encodeURIComponent(r.practiceWords[0])}&from=${encodeURIComponent(`/script/run/${id}`)}` : null;
  const lessonSym = top?.pair.split('→')[0];
  return (
    <AppShell tabs={false} wide>
      <BackHeader title={`${run.doc.title} · 슬라이드 ${run.slideFrom}~${run.slideTo}`} href={back} />
      <div className="flex flex-col gap-1 px-6 pt-2 lg:px-0">
        <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">
          {dur(r.durationSec)} {finished ? '끝까지 읽었어요! 대단해요' : '읽었어요!'}
        </span>
        <h1 className="mt-1 font-jua text-[28px] leading-tight">
          {r.totalSentences}문장 중 {r.clearSentences}문장이 또렷했어요
        </h1>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {top && <span className="rounded-full bg-coral-soft px-3 py-1 text-xs font-bold text-coral-ink">{top.pair} {top.count}번 바뀜</span>}
          {r.endDrops > 0 && <span className="rounded-full bg-coral-soft px-3 py-1 text-xs font-bold text-coral-ink">{r.endDrops}문장 끝소리 작아짐</span>}
          {r.fasterFromSec != null && <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">{mmss(r.fasterFromSec)} 뒤 점점 빨라짐</span>}
        </div>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-10 pt-4 lg:grid lg:grid-cols-[1.5fr_1fr] lg:items-start lg:px-0">
        <div className="flex flex-col gap-3">
          {r.rateWindows.length > 1 && (
            <Card className="flex flex-col gap-2">
              <b className="text-sm">발표 흐름에서 달라진 곳 · 빠르기</b>
              <div className="flex h-16 items-end gap-1" role="img" aria-label="20초마다 초당 글자 수">
                {r.rateWindows.map((w) => (
                  <span key={w.t} className={cx('flex-1 rounded-t-md', r.fasterFromSec != null && w.t >= r.fasterFromSec ? 'bg-coral' : 'bg-brand-light')} style={{ height: `${((w.rate ?? 0) / maxRate) * 100}%` }} title={`${mmss(w.t)} · 초당 ${w.rate ?? '—'}글자`} />
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted">
                <span>0:00</span>
                {r.fasterFromSec != null && <span className="text-coral-ink">{mmss(r.fasterFromSec)} · 여기부터 말이 빨라졌어요</span>}
                <span>{mmss(r.durationSec)}</span>
              </div>
            </Card>
          )}
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-sm">원고에 맞춰 본 내 말</b>
              <span className="flex flex-wrap gap-2 text-[11px] text-sub">
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-coral" />달라진 발음</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-line2" />건너뛴 말</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-light" />원고에 없는 말</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-lime" />끝소리 작아짐</span>
              </span>
            </div>
            {slidesShown.map((n) => (
              <div key={n} className="flex flex-col gap-2">
                <span className="text-xs font-bold text-brand-dark">슬라이드 {n}</span>
                {r.sentences
                  .map((s, si) => ({ s, si }))
                  .filter(({ s }) => s.slide === n)
                  .map(({ s, si }) => (
                    <p key={si} className="text-[15px] leading-[2.1]">
                      <span className="mr-2 text-xs text-faint">{si + 1}</span>
                      {s.words.map((k, wi) => {
                        const w = r.words[k];
                        const last = wi === s.words.length - 1;
                        return (
                          <span key={k}>
                            <span className={cx('rounded-md px-0.5', w.status === 'changed' && 'bg-coral-soft text-coral-ink', w.status === 'skipped' && 'bg-tint text-faint line-through', last && s.endDrop && 'bg-lime text-lime-ink')}>{w.text}</span>
                            {w.status === 'changed' && w.heard && <span className="ml-0.5 rounded-md bg-coral px-1 text-xs font-bold text-ink">들린 대로 {w.heard}</span>}
                            {w.status === 'skipped' && <span className="ml-0.5 text-[11px] font-bold text-muted">건너뜀</span>}
                            {last && s.endDrop && <span className="ml-0.5 text-[11px] font-bold text-lime-ink">끝 작아짐</span>}{' '}
                          </span>
                        );
                      })}
                      {s.extras.map((e, i) => (
                        <span key={i} className="ml-1 rounded-md bg-brand-light px-1 text-sm text-brand-deep">
                          {e}
                        </span>
                      ))}
                    </p>
                  ))}
              </div>
            ))}
          </Card>
        </div>
        <div className="flex flex-col gap-3 lg:sticky lg:top-4">
          {r.practiceWords.length > 0 && (
            <Card className="flex flex-col gap-2">
              <b className="text-sm">달라진 단어 {r.practiceWords.length}개로 연습하기</b>
              <div className="flex flex-wrap gap-1.5">
                {r.practiceWords.map((w) => (
                  <Link key={w} href={`/practice/custom?text=${encodeURIComponent(w)}&from=${encodeURIComponent(`/script/run/${id}`)}`} className="rounded-xl bg-coral-soft px-3 py-1.5 font-jua text-coral-ink">
                    {w}
                  </Link>
                ))}
              </div>
              {practiceHref && <Button href={practiceHref}>달라진 단어 연습 시작</Button>}
            </Card>
          )}
          {(r.substitutions.length > 0 || r.endDrops > 0) && (
            <Card className="flex flex-col gap-2">
              <b className="text-sm">자주 달라진 소리</b>
              <div className="flex flex-wrap gap-2">
                {r.substitutions.slice(0, 4).map((x) => (
                  <span key={x.pair} className="flex flex-col items-center rounded-2xl bg-bg px-4 py-2">
                    <b className="font-jua text-lg">{x.pair}</b>
                    <span className="text-xs text-muted">{x.count}</span>
                  </span>
                ))}
                {r.endDrops > 0 && (
                  <span className="flex flex-col items-center rounded-2xl bg-bg px-4 py-2">
                    <b className="font-jua text-lg">끝소리</b>
                    <span className="text-xs text-muted">{r.endDrops}</span>
                  </span>
                )}
              </div>
              {lessonSym && (
                <Link href={`/learn/${encodeURIComponent(lessonSym)}`} className="text-sm font-bold text-brand-dark">
                  {lessonSym} 레슨으로 가기 →
                </Link>
              )}
            </Card>
          )}
          {r.goodSounds.length > 0 && (
            <Card className="flex flex-col gap-1 bg-pass-soft shadow-none">
              <b className="text-sm text-pass-ink">잘한 점</b>
              <span className="text-sm leading-relaxed text-pass-ink">
                {r.goodSounds.join('·')}은(는) {r.totalSentences}문장 내내 또렷했어요.
              </span>
            </Card>
          )}
          <p className="text-xs leading-relaxed text-muted">들린 대로는 한국어 받아쓰기 모델이 단어 단위로 들은 결과예요. 원고는 비교에만 쓰고, 원하면 바로 지울 수 있어요.</p>
        </div>
      </div>
    </AppShell>
  );
}
