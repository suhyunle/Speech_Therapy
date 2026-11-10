'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, cx } from '@/components/ui';
import { errorText } from '@/services/api';
import { meApi } from '@/services/endpoints';
import { enablePush, pushSupported } from '@/services/push';

const GOALS = [
  { n: 3, t: '가볍게 · 3개', d: '발성 1분 + 단어 3개 · 약 5분' },
  { n: 5, t: '꾸준히 · 5개', d: '발성 1분 + 단어 4개 + 문장 1개 · 약 9분', rec: true },
  { n: 10, t: '열심히 · 10개', d: '발성 1분 + 단어 7개 + 문장 3개 · 약 18분' },
] as const;
const TIMES = [
  { v: '08:00', t: '아침 8시' },
  { v: '12:00', t: '점심 12시' },
  { v: '20:00', t: '저녁 8시' },
];

/** 하루 목표 고르기 (GoalSetup · WebOnboarding 4단계에서 함께 쓴다) */
export function GoalPicker() {
  const router = useRouter();
  const [goal, setGoal] = useState<3 | 5 | 10>(5);
  const [time, setTime] = useState('20:00');
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const save = async (withReminder: boolean) => {
    try {
      await meApi.updateSettings({ dailyGoal: goal, reminderEnabled: withReminder, reminderTime: withReminder ? time : null, onboarded: true });
      if (withReminder && pushSupported()) {
        const r = await enablePush().catch((e) => ({ ok: false, reason: errorText(e) }));
        if (!r.ok) setNote(`알림 시간은 저장했어요. ${r.reason ?? ''}`);
      }
      router.replace('/home');
    } catch (e) {
      setErr(errorText(e));
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-jua text-[30px] leading-tight">
        하루에 얼마나
        <br />
        연습할까요?
      </h2>
      <div role="radiogroup" aria-label="하루 목표" className="flex flex-col gap-2.5">
        {GOALS.map((g) => (
          <button key={g.n} type="button" role="radio" aria-checked={goal === g.n} onClick={() => setGoal(g.n)} className={cx('flex items-center justify-between rounded-[20px] border-[3px] bg-white px-4 py-3.5 text-left', goal === g.n ? 'border-brand shadow-[0_4px_0_#C9C3FF]' : 'border-transparent shadow-chip')}>
            <span className="flex flex-col">
              <b className="font-jua text-[20px] font-normal">{g.t}</b>
              <span className="text-[13px] text-sub">{g.d}</span>
            </span>
            {'rec' in g && <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">추천</span>}
          </button>
        ))}
      </div>
      <span className="text-sm font-bold text-pass-text">{goal}개면 일주일에 {goal * 7}번 말하게 돼요!</span>
      <b className="pt-2 text-[15px]">언제 알려드릴까요?</b>
      <div role="radiogroup" aria-label="알림 시간" className="flex gap-2">
        {TIMES.map((t) => (
          <button key={t.v} type="button" role="radio" aria-checked={time === t.v} onClick={() => setTime(t.v)} className={cx('min-h-[48px] flex-1 rounded-2xl text-sm font-bold', time === t.v ? 'bg-ink text-white' : 'bg-white text-sub shadow-chip')}>
            {t.t}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted">소리 대신 진동과 화면(브라우저 알림)으로 알려드려요 · 설정에서 언제든 바꿔요</span>
      {err && <p role="alert" className="text-sm font-bold text-coral-ink">{err}</p>}
      {note && <p role="status" className="text-sm text-sub">{note}</p>}
      <div className="flex flex-col gap-2 pt-2">
        <Button onClick={() => save(true)}>하루 {goal}개로 시작하기</Button>
        <Button variant="ghost" onClick={() => save(false)}>
          알림 없이 시작할게요
        </Button>
      </div>
    </div>
  );
}

