'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell, Button, Card, ErrorState, Loading, Mascot, Sheet, cx } from '@/components/ui';
import { errorText } from '@/services/api';
import { attemptsApi, diaryApi, meApi, planApi, progressApi } from '@/services/endpoints';

const FEELINGS = [
  { v: 'EASY', t: '쉬웠어요' },
  { v: 'OK', t: '보통' },
  { v: 'HARD', t: '어려웠어요' },
  { v: 'TIRED', t: '입이 피곤해요' },
];

/** 디자인: Complete · 오늘의 학습 완료 → Diary · 한 줄 일기 */
export default function CompletePage() {
  const router = useRouter();
  const plan = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  const diary = useQuery({ queryKey: ['diary'], queryFn: diaryApi.today });
  const prog = useQuery({ queryKey: ['progress'], queryFn: progressApi.summary });
  const settings = useQuery({ queryKey: ['settings'], queryFn: meApi.settings });
  const recent = useQuery({ queryKey: ['attempts', 'today'], queryFn: () => attemptsApi.list(undefined, 50) });
  const [open, setOpen] = useState(false);
  const [feeling, setFeeling] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (plan.isLoading) return <Loading />;
  if (plan.error || !plan.data) return <ErrorState message={errorText(plan.error)} onRetry={() => plan.refetch()} />;
  const p = plan.data;
  const reached = p.completed >= p.goal;
  const today = p.date;
  const seoulDay = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(iso));
  const passedToday = new Set((recent.data ?? []).filter((a) => a.passed && seoulDay(a.createdAt) === today).map((a) => a.targetText)).size;
  const more = prog.data ? prog.data.thisWeek - prog.data.lastWeek : null;
  const tomorrow = [
    p.current && `${p.current.symbol} 단어 ${p.goal}개`,
    p.weeklyDue[0] && `일주일 체크 · ${p.weeklyDue[0]} 기초선 단어 3개`,
    p.learnedCount + p.clearedCount > 0 && '복습 3개',
  ].filter(Boolean) as string[];
  const save = async () => {
    try {
      await diaryApi.save({ feeling, note });
      router.push('/home');
    } catch (e) {
      setErr(errorText(e));
    }
  };
  return (
    <AppShell tabs={false} wide>
      <div className="flex flex-1 flex-col px-5 pb-8 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:px-0">
      <div className="flex flex-col">
      <div className="flex flex-col items-center gap-3 pt-20 lg:items-start lg:pt-6">
        <Mascot size={110} mood="happy" className="mallang" />
        <span className="text-sm font-bold text-brand-dark">{reached ? '오늘의 학습 완료' : '오늘은 여기까지'}</span>
        <h1 className="text-center font-jua text-[30px] leading-tight">{reached ? '오늘 목표를 해냈어요!' : `${p.completed}개 했어요. 내일 이어서 해요!`}</h1>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {[
          { n: p.todayRecordings, u: '번', t: '말했어요' },
          { n: passedToday, u: '개', t: '오늘 통과한 단어' },
          { n: p.streak.current, u: '일', t: '연속' },
        ].map((x) => (
          <Card key={x.t} className="flex flex-col items-center gap-0.5 px-2 py-3">
            <span className="font-jua text-[26px] text-brand-dark">
              {x.n}
              <span className="text-base">{x.u}</span>
            </span>
            <span className="text-xs text-sub">{x.t}</span>
          </Card>
        ))}
      </div>
      <Card className="mt-3 flex flex-col gap-1">
        <span className="text-[13px] font-bold">오늘 한 단어</span>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {p.items.map((i) => (
            <span key={i.id} className={cx('rounded-xl px-2.5 py-1.5 text-sm font-bold', i.done ? 'bg-pass-soft text-pass-ink' : 'bg-bg text-muted')}>
              {i.text}
            </span>
          ))}
        </div>
      </Card>
      <Card className="mt-3 flex flex-col gap-2">
        <span className="text-[13px] font-bold">이번 주</span>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {p.week.map((d) => (
            <span key={d.date} className="flex flex-col items-center gap-1">
              <span className={cx('flex h-9 w-9 items-center justify-center rounded-full font-bold', d.completed ? 'bg-brand text-white' : d.recordings ? 'bg-brand-soft text-brand-dark' : 'bg-bg text-faint')}>{d.recordings || ''}</span>
              <span className={d.isToday ? 'font-bold text-brand-dark' : 'text-muted'}>{d.isToday ? '오늘' : '일월화수목금토'[new Date(d.date + 'T00:00:00+09:00').getDay()]}</span>
            </span>
          ))}
        </div>
        {more != null && more > 0 && <span className="self-start rounded-full bg-pass-soft px-3 py-1 text-xs font-bold text-pass-ink">지난주보다 {more}번 더 말했어요!</span>}
      </Card>
      </div>
      <aside className="flex flex-col gap-3 pt-3 lg:pt-6">
        {tomorrow.length > 0 && (
          <Card className="flex flex-col gap-2">
            <b className="text-sm">내일 할 것</b>
            {tomorrow.map((t) => (
              <span key={t} className="rounded-xl bg-bg px-3 py-2 text-sm">
                {t}
              </span>
            ))}
            {settings.data?.reminderEnabled && settings.data.reminderTime && <span className="text-xs text-muted">알림 · 내일 {settings.data.reminderTime}</span>}
          </Card>
        )}
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button onClick={() => setOpen(true)}>{diary.data?.entry ? '오늘 일기 고치기' : '오늘은 여기까지!'}</Button>
        <Button variant="ghost" href="/home">
          홈으로
        </Button>
      </div>
      </aside>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} label="오늘 한 줄 일기">
        <div className="flex flex-col gap-1">
          <span className="font-jua text-[24px]">오늘 한 줄 일기 · 10초</span>
          <span className="text-[13px] text-sub">나중에 나한테 맞는 연습을 찾는 데 도움이 돼요</span>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          <span className="rounded-[10px] bg-bg px-2.5 py-1.5 text-sub">{p.date}</span>
          {p.current && <span className="rounded-[10px] bg-bg px-2.5 py-1.5 text-sub">{p.current.symbol} · 단어 {p.completed}개</span>}
          <span className="rounded-[10px] bg-bg px-2.5 py-1.5 text-sub">녹음 {p.todayRecordings}번</span>
        </div>
        <b className="text-sm">오늘 어땠어요?</b>
        <div role="radiogroup" className="flex flex-wrap gap-1.5">
          {FEELINGS.map((f) => (
            <button key={f.v} type="button" role="radio" aria-checked={feeling === f.v} onClick={() => setFeeling(f.v)} className={cx('min-h-[40px] rounded-full px-3 text-[13px] font-bold', feeling === f.v ? 'bg-brand text-white' : 'bg-bg text-sub')}>
              {f.t}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          한 줄 (선택)
          <textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className="resize-none rounded-[14px] border-2 border-line px-3.5 py-3 text-[15px] font-normal leading-normal outline-none focus:border-brand" />
        </label>
        {err && <p role="alert" className="text-sm font-bold text-coral-ink">{err}</p>}
        <div className="grid grid-cols-[1fr_1.6fr] gap-2">
          <Button variant="outline" href="/home">
            건너뛰기
          </Button>
          <Button onClick={save}>저장하기</Button>
        </div>
      </Sheet>
    </AppShell>
  );
}
