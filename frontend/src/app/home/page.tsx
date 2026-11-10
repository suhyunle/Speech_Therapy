'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell, Button, ErrorState, Icon, Loading, Logo, Svg, cx } from '@/components/ui';
import { errorText } from '@/services/api';
import { attemptsApi, planApi } from '@/services/endpoints';
import type { PathNode, TodayPlan } from '@/types/api';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const ZIG = [139, 72, 139, 180, 139, 72];

function Stat({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <span aria-label={label} className={cx('flex h-[34px] items-center gap-1 rounded-xl bg-white px-2.5 font-jua text-base shadow-chip', color)}>
      {icon}
      {value}
    </span>
  );
}

function Node({ n, first }: { n: PathNode; first: boolean }) {
  if (n.state === 'ALREADY_GOOD')
    return (
      <div className="flex items-center gap-3">
        <div aria-label={`${n.symbol} 이미 발음이 좋아요`} className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-pass font-jua text-[30px] text-white shadow-[0_6px_0_#0E7A53]">
          {n.symbol}
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-pass bg-white text-pass">
            <Svg size={12} stroke={3.6}>
              {Icon.check}
            </Svg>
          </span>
        </div>
        {first && <span className="rounded-xl bg-pass-soft px-2.5 py-1.5 text-xs font-bold text-pass-ink">이미 발음이 좋아요</span>}
      </div>
    );
  if (n.state === 'LEARNED')
    return (
      <div aria-label={`${n.symbol} 배웠어요`} className="flex h-16 w-16 items-center justify-center rounded-full bg-lime font-jua text-[30px] text-lime-ink shadow-[0_6px_0_#A6D46A]">
        {n.symbol}
      </div>
    );
  return (
    <div aria-label={`${n.symbol} 아직이에요`} className="flex h-16 w-16 items-center justify-center rounded-full bg-white font-jua text-[30px] text-line2 shadow-[0_6px_0_#E6E3F2]">
      {n.symbol}
    </div>
  );
}

function Path({ plan }: { plan: TodayPlan }) {
  const cur = plan.current;
  const ci = cur ? plan.path.findIndex((p) => p.symbol === cur.symbol) : plan.path.length;
  const before = plan.path.slice(Math.max(0, ci - 3), ci);
  const after = plan.path.slice(ci + 1, ci + 3);
  const firstGood = plan.path.find((p) => p.state === 'ALREADY_GOOD')?.symbol;
  const target = plan.items.find((i) => !i.done) ?? plan.items[0];
  return (
    <section aria-label="학습 경로" className="relative flex flex-1 flex-col gap-2 px-5 pt-3.5">
      {before.map((n, i) => (
        <div key={n.symbol} style={{ paddingLeft: ZIG[i % ZIG.length] }}>
          <Node n={n} first={n.symbol === firstGood} />
        </div>
      ))}
      {cur && (
        <div className="flex flex-col items-start gap-1.5" style={{ paddingLeft: 180 }}>
          <span className="ml-4 rounded-xl border-2 border-line bg-white px-3 py-1.5 font-jua text-base text-brand-dark">{cur.state === 'LEARNING' ? '이어서!' : '시작!'}</span>
          <Link href={`/learn/${encodeURIComponent(cur.symbol)}${target ? `?next=${target.id}` : ''}`} aria-label={`${cur.symbol} 배우기 시작`} className="relative flex h-[100px] w-[100px] items-center justify-center">
            <span className="absolute inset-0 rounded-full border-[6px] border-brand-light" aria-hidden />
            <span className="mallang flex h-[74px] w-[74px] items-center justify-center rounded-full bg-brand font-jua text-[36px] text-white shadow-node">{cur.symbol}</span>
          </Link>
        </div>
      )}
      {after.map((n, i) => (
        <div key={n.symbol} style={{ paddingLeft: ZIG[(i + 4) % ZIG.length] }}>
          <Node n={n} first={false} />
        </div>
      ))}
      <div className="absolute left-4 top-[40%] w-[150px] rounded-[4px_14px_14px_14px] border-2 border-line bg-white px-2.5 py-2 text-xs leading-relaxed">
        {plan.thisWeekRecordings > 0 ? (
          <>
            이번 주 벌써 <b className="text-brand-dark">{plan.thisWeekRecordings}번</b> 말했어요!
          </>
        ) : (
          <>오늘 첫 소리를 들려주세요!</>
        )}
      </div>
    </section>
  );
}

/** 디자인: Main · 홈 학습 경로 */
export default function HomePage() {
  const q = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  const router = useRouter();
  // 이틀 넘게 쉬다 돌아오면 '다시 만나서 반가워요' (StreakLost) — 하루 한 번
  useEffect(() => {
    const d = q.data;
    if (!d || !d.streak.broken || (d.daysAway ?? 0) < 2) return;
    const key = `malang-welcome-back-${d.date}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    router.push('/welcome-back');
  }, [q.data, router]);
  return (
    <AppShell wide>
      {q.isLoading && <Loading />}
      {q.error && <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />}
      {q.data && (
        <>
          <div className="lg:hidden">
            <Home plan={q.data} />
          </div>
          <div className="hidden lg:block">
            <Dashboard plan={q.data} />
          </div>
        </>
      )}
    </AppShell>
  );
}

function Home({ plan }: { plan: TodayPlan }) {
  const left = Math.max(0, plan.goal - plan.completed);
  const next = plan.items.find((i) => !i.done);
  const cur = plan.current;
  const dash = 2 * Math.PI * 24;
  return (
    <>
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),24px)] md:pt-6">
        <span className="md:invisible">
          <Logo />
        </span>
        <div className="flex gap-1.5">
          <Stat label={`${plan.streak.current}일 연속`} value={plan.streak.current} color="text-coral-ink" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="#FF6B3D" aria-hidden><path d="M12 2c1 4.5 7 6.5 7 12.5a7 7 0 0 1-14 0c0-3.5 2.2-5 3.3-7 1 2.2 2.2 2.6 3.2 2.6C11.5 7 11 4.5 12 2z" /></svg>} />
          <Stat label={`오늘 녹음 ${plan.todayRecordings}회`} value={plan.todayRecordings} color="text-brand-dark" icon={<span className="text-brand"><Svg size={16} stroke={2.6}>{Icon.mic}</Svg></span>} />
          <Stat label={`클리어한 소리 ${plan.clearedCount}개`} value={plan.clearedCount} color="text-pass-text" icon={<span className="text-pass"><Svg size={16} stroke={3}>{Icon.check}</Svg></span>} />
        </div>
      </header>
      {plan.isGuest && (
        <Link href="/signup" className="mx-5 mt-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white">
          지금은 손님 모드예요 · <b className="underline">가입하면 기록이 그대로 저장돼요</b>
        </Link>
      )}
      {plan.streak.broken && <p className="mx-5 mt-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-chip">다시 만나서 반가워요! 오늘 하나만 해도 다시 시작이에요.</p>}
      <div aria-label="연습 순서" className="mx-5 mt-3.5 flex gap-1 rounded-2xl bg-line p-1">
        {plan.groups.map((g) => (
          <span key={g.key} className={cx('flex h-10 min-w-0 items-center justify-center rounded-xl text-xs font-bold', g.current ? 'flex-[1.3] bg-brand text-white shadow-[0_3px_0_#3F31D6]' : g.done ? 'flex-1 bg-lime text-lime-ink' : 'flex-1 bg-white text-faint')}>
            {g.label}
            {g.done ? ' ✓' : g.current ? ' 지금' : ''}
          </span>
        ))}
      </div>
      <section aria-label="오늘의 학습" className="mx-5 mt-3 flex flex-col gap-2.5 rounded-[22px] bg-brand p-3.5 text-white shadow-btn">
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 shrink-0">
            <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
              <circle cx="28" cy="28" r="24" fill="none" stroke="#7F72FF" strokeWidth="6" />
              <circle cx="28" cy="28" r="24" fill="none" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={dash * (1 - Math.min(1, plan.completed / plan.goal))} transform="rotate(-90 28 28)" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-jua text-[17px]">
              {plan.completed}/{plan.goal}
            </span>
          </div>
          <div className="flex flex-grow flex-col">
            <span className="text-xs font-bold text-brand-light">
              오늘의 학습 · {cur ? `${cur.symbol} 소리` : '모든 소리 완료'}
            </span>
            <span className="font-jua text-[20px]">{left === 0 ? '오늘 목표 달성!' : left <= 2 ? `${left}개만 더 하면 끝!` : `오늘 ${left}개 해볼까요?`}</span>
            <span className="text-xs text-brand-light">{left === 0 ? '더 하고 싶으면 이어서 해도 돼요' : `약 ${Math.max(1, Math.round(left * 1.2))}분 남았어요`}</span>
          </div>
          {cur && (
            <Link href={next ? `/practice/${next.id}?sound=${encodeURIComponent(cur.symbol)}` : `/learn/${encodeURIComponent(cur.symbol)}`} aria-label="오늘의 학습 이어서 하기" className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl bg-white text-brand-dark shadow-[0_4px_0_#CFCBE3]">
              <Svg size={24} fill="currentColor" stroke={0}>
                {Icon.play}
              </Svg>
            </Link>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1 border-t-[1.5px] border-brand-mid pt-2.5">
          {plan.week.map((d, i) => (
            <div key={d.date} className="flex flex-col items-center gap-[3px]">
              <span className={cx('flex h-6 w-6 items-center justify-center rounded-full', d.completed ? 'bg-white text-brand' : d.isToday ? 'border-[2.5px] border-white bg-wind' : 'bg-brand-mid')}>
                {d.completed && (
                  <Svg size={12} stroke={3.6}>
                    {Icon.check}
                  </Svg>
                )}
              </span>
              <span className={cx('text-[10px]', d.isToday ? 'font-bold text-white' : 'text-brand-light')}>{d.isToday ? '오늘' : DAYS[i]}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="mx-5 mt-3 grid grid-cols-2 gap-2">
        {plan.warmup && (
          <Link href="/voice/forward" className={cx('flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl text-sm font-bold', plan.warmup.done ? 'bg-pass-soft text-pass-ink' : 'bg-white text-brand-dark shadow-chip')}>
            {plan.warmup.done ? '✓ 발성 준비 끝' : '1분 발성 준비'}
          </Link>
        )}
        <Link href="/script" className="flex min-h-[48px] items-center justify-center rounded-2xl bg-white text-sm font-bold text-brand-dark shadow-chip">
          내 글로 연습
        </Link>
      </div>
      {plan.weeklyDue.length > 0 && (
        <Link href={`/weekly/${encodeURIComponent(plan.weeklyDue[0])}`} className="mx-5 mt-3 flex items-center justify-between rounded-2xl bg-lime px-4 py-3 text-sm text-lime-ink">
          <span>
            <b>일주일 체크</b> · {plan.weeklyDue[0]} 기초선 단어 3개로 비교해요
          </span>
          <span aria-hidden>›</span>
        </Link>
      )}
      {!plan.hasBaseline && !plan.isGuest && (
        <div className="mx-5 mt-3">
          <Button variant="outline" href="/start">
            시작 준비 · 기준 목소리 녹음하기
          </Button>
        </div>
      )}
      <Path plan={plan} />
    </>
  );
}

const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', hour12: false }).format(new Date()));
  return h < 11 ? '좋은 아침이에요' : h < 17 ? '좋은 오후예요' : '좋은 저녁이에요';
};
const STATE_TILE: Record<string, string> = {
  ALREADY_GOOD: 'bg-pass text-white',
  LEARNED: 'bg-lime text-lime-ink',
  LEARNING: 'bg-brand text-white',
  LOCKED: 'bg-bg text-faint',
};
const STATE_LABEL: Record<string, string> = { ALREADY_GOOD: '이미 좋아요', LEARNED: '완료', LEARNING: '지금 배워요', LOCKED: '잠김' };

/** 디자인: WebHome · 홈 대시보드 (넓은 화면) */
function Dashboard({ plan }: { plan: TodayPlan }) {
  const recent = useQuery({ queryKey: ['attempts', 'recent'], queryFn: () => attemptsApi.list(undefined, 6) });
  const cur = plan.current;
  const unit = cur ? plan.path.filter((p) => p.group === cur.group) : [];
  const unitIdx = plan.groups.findIndex((g) => g.key === cur?.group) + 1;
  const unitDone = unit.filter((p) => p.state === 'ALREADY_GOOD' || p.state === 'LEARNED').length;
  const next = plan.items.find((i) => !i.done);
  const node = (s: string) => plan.path.find((p) => p.symbol === s);
  const tile = (s: string) => (cur?.symbol === s ? 'bg-brand text-white' : STATE_TILE[node(s)?.state ?? 'LOCKED']);
  const count = (st: string) => plan.path.filter((p) => p.state === st).length;
  const cleared = plan.path.filter((p) => p.state === 'ALREADY_GOOD').map((p) => p.symbol);
  return (
    <div className="flex flex-col gap-5 pb-10 pt-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-jua text-[34px]">{greeting()}</h1>
          <p className="text-[17px] text-sub">{cur ? `오늘은 ${cur.symbol} 소리를 연습해요` : '모든 소리를 끝냈어요! 억양·길이를 연습해요'}</p>
        </div>
        <div className="flex gap-2">
          <span className="rounded-2xl bg-white px-4 py-2 font-jua text-lg text-coral-ink shadow-chip">{plan.streak.current}일 연속</span>
          <span className="rounded-2xl bg-white px-4 py-2 font-jua text-lg text-brand-dark shadow-chip">오늘 녹음 {plan.todayRecordings}회</span>
        </div>
      </div>
      <div className="grid grid-cols-[1.3fr_1fr] gap-5">
        <div className="flex flex-col gap-5">
          {cur && (
            <section className="flex flex-col gap-3 rounded-[26px] bg-white p-5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-brand-dark">
                  {unitIdx}단원 · {unit.length}개 중 {unitDone}개 완료
                </span>
                <span className="text-sm text-muted">{plan.groups.find((g) => g.key === cur.group)?.label}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {unit.map((p) => (
                  <Link key={p.symbol} href={`/learn/${encodeURIComponent(p.symbol)}`} className={cx('flex min-w-[88px] flex-col items-center gap-0.5 rounded-2xl px-3 py-2.5', p.symbol === cur.symbol ? 'bg-brand text-white shadow-btn' : STATE_TILE[p.state])}>
                    <span className="font-jua text-[28px]">{p.symbol}</span>
                    <span className="text-[11px] font-bold">{p.symbol === cur.symbol ? '지금 배워요' : STATE_LABEL[p.state]}</span>
                  </Link>
                ))}
              </div>
              <Button href={plan.baselineNeeded ? `/baseline/${encodeURIComponent(cur.symbol)}` : next ? `/practice/${next.id}?sound=${encodeURIComponent(cur.symbol)}` : `/learn/${encodeURIComponent(cur.symbol)}`} className="max-w-[280px]">
                {cur.symbol} 이어서 하기
              </Button>
            </section>
          )}
          <section className="flex flex-col gap-3 rounded-[26px] bg-white p-5 shadow-card">
            <b>최근 녹음</b>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="pb-2">단어</th>
                  <th className="pb-2">소리</th>
                  <th className="pb-2">바람 유지</th>
                  <th className="pb-2">확인한 것</th>
                </tr>
              </thead>
              <tbody>
                {(recent.data ?? []).map((a) => {
                  const ops = a.result?.phonemes?.ops ?? [];
                  const ch = ops.find((o) => o.type === 'sub' && o.target && o.got);
                  return (
                    <tr key={a.id} className="border-t-2 border-line">
                      <td className="py-2.5 font-bold">
                        <Link href={`/result/${a.id}`}>{a.targetText}</Link>
                      </td>
                      <td>{a.soundSymbol ?? '—'}</td>
                      <td>{a.result?.measures?.hiss ? `${a.result.measures.hiss.hissSec}초` : '—'}</td>
                      <td className={ch ? 'text-coral-ink' : 'text-pass-text'}>{a.status !== 'DONE' ? '녹음 문제' : a.context === 'EXERCISE' ? '발성 연습' : ch ? `${ch.target!.symbol} → ${ch.got!.symbol}로 바뀜` : a.passed ? '잘 이어짐' : '확인 중'}</td>
                    </tr>
                  );
                })}
                {recent.data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted">
                      아직 녹음이 없어요. 첫 녹음부터 ‘처음 내 소리’로 남겨둘게요
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3 rounded-[26px] bg-white p-5 shadow-card">
            <div className="flex justify-between">
              <b>소리 지도</b>
              <span className="text-sm text-muted">자음 13 · 모음 10</span>
            </div>
            <span className="text-xs font-bold text-sub">자음</span>
            <div className="grid grid-cols-7 gap-1.5">
              {'ㄱㄴㄷㄹㅁㅂㅅㅈㅊㅋㅌㅍㅎ'.split('').map((c) => (
                <Link key={c} href={`/learn/${encodeURIComponent(c)}`} className={cx('flex h-10 items-center justify-center rounded-xl font-jua text-lg', tile(c))}>
                  {c}
                </Link>
              ))}
            </div>
            <span className="text-xs font-bold text-sub">모음</span>
            <div className="grid grid-cols-5 gap-1.5">
              {'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ'.split('').map((c) => (
                <Link key={c} href={`/learn/${encodeURIComponent(c)}`} className={cx('flex h-10 items-center justify-center rounded-xl font-jua text-lg', tile(c))}>
                  {c}
                </Link>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs text-sub">
              <span>이미 좋아요 {count('ALREADY_GOOD')}</span>
              <span>학습 완료 {count('LEARNED')}</span>
              <span>지금 배우는 중 {cur?.symbol ?? '—'}</span>
              <span>남은 소리 {count('LOCKED') + count('LEARNING')}</span>
            </div>
          </section>
          {cleared.length > 0 && (
            <section className="flex flex-col gap-1.5 rounded-[26px] bg-pass-soft p-5">
              <b className="text-pass-ink">진단에서 클리어한 소리</b>
              <span className="text-sm leading-relaxed text-pass-ink">
                {cleared.join(' ')}는 글자, 단어, 문장에서 모두 잘 소리 냈어요. 다시 확인하고 싶으면 언제든 연습할 수 있어요.
              </span>
            </section>
          )}
          <div className="grid grid-cols-2 gap-2">
            {plan.warmup && (
              <Link href="/voice/forward" className="rounded-2xl bg-white p-4 text-sm font-bold shadow-chip">
                {plan.warmup.done ? '✓ 발성 준비 끝' : '1분 발성 준비 →'}
              </Link>
            )}
            {plan.weeklyDue[0] && (
              <Link href={`/weekly/${encodeURIComponent(plan.weeklyDue[0])}`} className="rounded-2xl bg-lime p-4 text-sm font-bold text-lime-ink">
                일주일 체크 · {plan.weeklyDue[0]} →
              </Link>
            )}
            {plan.learnedCount + plan.clearedCount > 0 && (
              <Link href="/review" className="rounded-2xl bg-white p-4 text-sm font-bold shadow-chip">
                복습 3개 →
              </Link>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted">휴대폰 앱과 학습 기록이 이어져요. 마이크가 좋은 기기로 녹음하면 더 정확하게 볼 수 있어요.</p>
        </div>
      </div>
    </div>
  );
}
