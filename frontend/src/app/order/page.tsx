'use client';
import { useQuery } from '@tanstack/react-query';
import { AppShell, BackHeader, Button, Card, cx } from '@/components/ui';
import { GoalPicker } from '@/features/onboarding/GoalPicker';
import { planApi } from '@/services/endpoints';

const STAGES = [
  { key: 'vowel', t: '모음 10개', s: 'ㅣ·ㅏ·ㅜ 끝 모음부터. 모음이 가장 크게 좌우해요' },
  { key: 'diphthong', t: '이중모음', s: 'ㅘ·ㅝ·ㅢ처럼 두 입모양을 잇는 소리' },
  { key: 'fric', t: 'ㅅ · ㅆ 바람소리', s: '자주 빠지거나 ‘쉬’처럼 나는 소리' },
  { key: 'stop', t: '가 · 카 · 까', s: '같은 자리, 다른 세기' },
  { key: 'prosody', t: '억양 · 길이', s: '묻는 말 끝 올리기, 길게 끌지 않기' },
];

/** 디자인: LearnOrder · 진단 끝 내 연습 순서 (+ 웹: WebOnboarding 3·4 단계를 한 화면에) */
export default function OrderPage() {
  const plan = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  const groups = plan.data?.groups ?? [];
  const firstOpen = groups.find((g) => !g.done)?.key;
  const skipped = groups.filter((g) => g.done).length;
  return (
    <AppShell tabs={false} wide>
      <BackHeader title="진단 끝 · 내 연습 순서" />
      <div className="flex flex-col gap-5 px-6 pb-8 pt-2 lg:grid lg:grid-cols-[1.2fr_1fr] lg:gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="font-jua text-[30px] leading-tight">
            말이 또렷해지는
            <br />
            순서대로 연습해요
          </h1>
          <ol className="flex flex-col gap-2">
            {STAGES.map((st, i) => {
              const g = groups.find((x) => x.key === st.key);
              const here = st.key === firstOpen;
              return (
                <li key={st.key} className={cx('flex items-center gap-3 rounded-[20px] px-4 py-3', here ? 'bg-brand text-white shadow-btn' : g?.done ? 'bg-pass-soft' : 'bg-white shadow-chip')}>
                  <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-jua text-lg', here ? 'bg-white text-brand-dark' : g?.done ? 'bg-pass text-white' : 'bg-brand-soft text-brand-dark')}>{i + 1}</span>
                  <span className="flex flex-1 flex-col">
                    <b className="font-jua text-[19px] font-normal">{st.t}</b>
                    <span className={cx('text-[13px]', here ? 'text-brand-light' : 'text-sub')}>{st.s}</span>
                  </span>
                  {g?.done && <span className="rounded-full bg-pass px-2.5 py-1 text-xs font-bold text-white">이미 좋아요</span>}
                  {here && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-brand-dark">여기부터</span>}
                </li>
              );
            })}
          </ol>
          <Card className="flex flex-col gap-1.5">
            <b className="text-sm">왜 이 순서예요?</b>
            <p className="text-sm leading-relaxed text-sub">연구에서 자음·모음만 바로잡아도 알아듣는 정도가 크게 올랐고, 억양만 고쳤을 때는 덜 올랐어요. 그래서 억양은 마지막에 해요.</p>
            <span className="text-[11px] text-muted">출처: 아동 말 교정 실험(영어권)</span>
          </Card>
          {skipped > 0 && <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">진단에서 좋았던 단계는 건너뛰어요. 바로 {skipped + 1}단계부터!</span>}
        </div>
        <div className="hidden lg:block">
          <GoalPicker />
        </div>
        <div className="lg:hidden">
          <Button href="/start/goal">좋아요, 하루 목표 정하기</Button>
        </div>
      </div>
    </AppShell>
  );
}
