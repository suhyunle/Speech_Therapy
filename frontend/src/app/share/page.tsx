'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppShell, BackHeader, Button, Card, Empty, Loading, cx } from '@/components/ui';
import { Qr } from '@/components/ui/Qr';
import { GROUPS, ListenerTable, type MyLink } from '@/features/share/ListenerTable';
import { errorText } from '@/services/api';
import { attemptsApi, listenApi } from '@/services/endpoints';

const CTX: Record<string, string> = { BASELINE: '기초선', WEEKLY: '일주일 체크', PLACEMENT: '진단', REVIEW: '복습', EXERCISE: '발성' };
const when = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  return d <= 0 ? '오늘' : d === 1 ? '어제' : new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
};

/** 디자인: ListenerShare · WebListeners · 사람 귀가 기준이에요 */
function Share() {
  const sp = useSearchParams();
  const recs = useQuery({ queryKey: ['attempts-done'], queryFn: () => attemptsApi.list(undefined, 60) });
  const links = useQuery({ queryKey: ['listen-links'], queryFn: () => listenApi.mine() as Promise<MyLink[]> });
  const [picked, setPicked] = useState<string[]>([]);
  const [group, setGroup] = useState('FAMILY');
  const [copied, setCopied] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => listenApi.create(picked, group),
    onSuccess: (l) => (setPicked([]), setMade(l.code), links.refetch()),
  });
  const usable = (recs.data ?? []).filter((a) => a.status === 'DONE' && a.recordingId && a.audioAvailable !== false);
  // 결과 화면·일주일 체크에서 넘어오면 그 녹음을 미리 골라 둔다
  useEffect(() => {
    if (!recs.data || picked.length) return;
    const ids = sp.get('ids')?.split(',').filter(Boolean) ?? [];
    const sound = sp.get('sound');
    const ctx = sp.get('context');
    const pre = ids.length ? usable.filter((a) => ids.includes(a.id)) : sound ? usable.filter((a) => a.soundSymbol === sound && (!ctx || a.context === ctx)).slice(0, 3) : [];
    if (pre.length) setPicked(pre.map((a) => a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recs.data]);
  const linkUrl = (code: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/l/${code}`;
  const copy = async (code: string) => {
    await navigator.clipboard?.writeText(linkUrl(code)).catch(() => undefined);
    setCopied(code);
  };
  const latest = links.data?.find((l) => l.listeners > 0);

  return (
    <AppShell wide>
      <BackHeader title="사람 귀로 확인받기" href="/home" />
      <div className="flex flex-col gap-1.5 px-6 pt-1 lg:px-0">
        <h1 className="font-jua text-[26px] leading-tight lg:text-[32px]">사람 귀가 기준이에요</h1>
        <p className="text-sm leading-relaxed text-sub">듣는 사람은 정답을 모른 채 들린 대로 적어요. 사람이 알아들었는데 앱이 다르면 앱이 틀린 걸로 기록해요.</p>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-10 pt-4 lg:grid lg:grid-cols-[1fr_1fr] lg:items-start lg:px-0">
        <div className="flex flex-col gap-3">
          {recs.isLoading && <Loading />}
          {recs.data && usable.length === 0 && <Empty title="들려줄 녹음이 아직 없어요" desc="연습에서 녹음을 하면 여기서 고를 수 있어요." />}
          {usable.length > 0 && (
            <>
              <Card className="flex flex-col gap-2">
                <b className="text-sm">새 받아쓰기 링크 · 들려줄 녹음 (최대 10개)</b>
                <div className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto">
                  {usable.slice(0, 30).map((a) => {
                    const on = picked.includes(a.id);
                    return (
                      <label key={a.id} className={cx('flex min-h-[52px] items-center gap-3 rounded-2xl px-3', on ? 'bg-brand-soft' : 'bg-bg')}>
                        <input type="checkbox" className="h-5 w-5 accent-brand" checked={on} disabled={!on && picked.length >= 10} onChange={(e) => setPicked(e.target.checked ? [...picked, a.id] : picked.filter((x) => x !== a.id))} />
                        <span className="flex flex-col">
                          <b className="text-[15px]">{a.targetText}</b>
                          <span className="text-xs text-muted">
                            {when(a.createdAt)}
                            {CTX[a.context] ? ` · ${CTX[a.context]}` : ''} · 앱이 ‘{a.heard ?? '?'}’로 들음
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Card>
              <Card className="flex flex-col gap-2">
                <b className="text-sm">누구에게</b>
                <div role="radiogroup" className="flex flex-wrap gap-2">
                  {GROUPS.map((g) => (
                    <button key={g.v} type="button" role="radio" aria-checked={group === g.v} onClick={() => setGroup(g.v)} className={cx('min-h-[44px] rounded-full px-4 text-sm font-bold', group === g.v ? 'bg-ink text-white' : 'bg-bg text-sub')}>
                      {g.t}
                    </button>
                  ))}
                </div>
                <span className="text-xs leading-relaxed text-muted">내 말을 자주 들어본 사람과 처음 듣는 사람은 다르게 알아들어요. 둘 다 받아보면 더 정확해요.</span>
              </Card>
              <span className="text-center text-xs text-muted">7일 뒤 사라져요 · 내 이름은 보이지 않아요 · 언제든 취소할 수 있어요</span>
              {create.error && <p role="alert" className="text-sm font-bold text-coral-ink">{errorText(create.error)}</p>}
              <Button disabled={!picked.length || create.isPending} onClick={() => create.mutate()}>
                받아쓰기 링크 만들기 {picked.length ? `(${picked.length}개)` : ''}
              </Button>
              {made && (
                <Card className="flex items-center gap-3 bg-brand-soft shadow-none">
                  <Qr url={linkUrl(made)} size={96} label="받아쓰기 링크 QR" />
                  <div className="flex flex-1 flex-col gap-2">
                    <code className="break-all text-xs text-sub">{linkUrl(made)}</code>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => copy(made)} className="min-h-[40px] rounded-xl bg-white px-3 text-xs font-bold text-brand-dark">
                        {copied === made ? '복사했어요' : '복사'}
                      </button>
                      <a href={`/l/${made}`} target="_blank" rel="noreferrer" className="flex min-h-[40px] items-center rounded-xl bg-white px-3 text-xs font-bold text-sub">
                        듣는 사람 화면 보기
                      </a>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {latest && (
            <Card className="hidden flex-col gap-2 lg:flex">
              <div className="flex justify-between text-sm">
                <b>결과 · {latest.listeners}명이 들었어요</b>
                <span className="text-sub">
                  사람과 앱 일치 {latest.agreement.agree}/{latest.agreement.total}
                </span>
              </div>
              <ListenerTable link={latest} />
            </Card>
          )}
          {links.data && links.data.length > 0 && <b className="text-sm">내가 만든 링크</b>}
          {links.data?.map((l) => (
            <Card key={l.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-sub">
                  {GROUPS.find((g) => g.v === l.group)?.t} · {l.items.length}개 · 들은 사람 {l.listeners}명 · {l.active ? `${new Date(l.expiresAt).toLocaleDateString('ko-KR')}까지` : '끝남'}
                </span>
                {l.active && (
                  <span className="flex gap-1">
                    <button type="button" onClick={() => copy(l.code)} className="min-h-[40px] rounded-xl bg-brand-soft px-3 text-xs font-bold text-brand-dark">
                      {copied === l.code ? '복사했어요' : '링크 복사'}
                    </button>
                    <button type="button" onClick={async () => (await listenApi.revoke(l.id), links.refetch())} className="min-h-[40px] rounded-xl bg-bg px-3 text-xs font-bold text-muted">
                      취소
                    </button>
                  </span>
                )}
              </div>
              <span className="text-sm">{l.items.map((i) => i.target).join(' · ')}</span>
              {l.listeners > 0 ? (
                <Link href={`/share/${l.id}`} className="text-sm font-bold text-brand-dark">
                  사람 귀 vs 앱 · 일치 {l.agreement.agree}/{l.agreement.total} ›
                </Link>
              ) : (
                <span className="text-xs text-muted">아직 받아쓴 사람이 없어요</span>
              )}
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Share />
    </Suspense>
  );
}
