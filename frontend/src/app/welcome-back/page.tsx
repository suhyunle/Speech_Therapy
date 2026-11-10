'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AppShell, Button, Card, ErrorState, Loading, Mascot } from '@/components/ui';
import { errorText } from '@/services/api';
import { meApi, planApi } from '@/services/endpoints';

/** 디자인: StreakLost · 연속 기록 끊김 — 탓하지 않고 가볍게 다시 시작 */
export default function WelcomeBackPage() {
  const q = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  const router = useRouter();
  const qc = useQueryClient();
  const smaller = useMutation({
    mutationFn: (goal: 3 | 5 | 10) => meApi.updateSettings({ dailyGoal: goal }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['plan'] });
      router.push('/home');
    },
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  const p = q.data;
  const learned = p.learnedCount + p.clearedCount;
  const lower = p.goal === 10 ? 5 : 3;
  return (
    <AppShell tabs={false}>
      <div className="flex flex-1 flex-col items-center gap-3 px-6 pt-14 text-center">
        <Mascot size={110} mood="calm" />
        <h1 className="font-jua text-[30px]">다시 만나서 반가워요!</h1>
        <p className="text-[16px] leading-relaxed text-sub">
          {p.daysAway ? `${p.daysAway}일 쉬었네요. ` : ''}쉬는 날도 필요해요.
          <br />
          배운 건 그대로 남아 있어요.
        </p>
        <div className="mt-2 grid w-full grid-cols-2 gap-3">
          <Card className="flex flex-col items-center gap-0.5">
            <b className="font-jua text-[30px] text-coral-ink">{p.streak.best}일</b>
            <span className="text-xs text-muted">최고 기록</span>
          </Card>
          <Card className="flex flex-col items-center gap-0.5">
            <b className="font-jua text-[30px] text-brand">{learned}개</b>
            <span className="text-xs text-muted">지금까지 배운 소리</span>
          </Card>
        </div>
        {learned > 0 && (
          <p className="rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-sub shadow-chip">
            오늘은 <b className="text-brand-dark">복습 3개</b>로 가볍게 시작해요. 쉬는 동안 흐려진 소리부터 다시 볼게요.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 px-5 pb-8 pt-5">
        <Button href={learned > 0 ? '/review' : '/home'}>{learned > 0 ? '복습 3개로 다시 시작하기' : '오늘 연습 시작하기'}</Button>
        {p.goal > 3 && (
          <Button variant="outline" onClick={() => smaller.mutate(lower)} disabled={smaller.isPending}>
            하루 목표 줄이기 ({p.goal}개 → {lower}개)
          </Button>
        )}
        {smaller.error && <p className="text-center text-sm text-coral-ink">{errorText(smaller.error)}</p>}
      </div>
    </AppShell>
  );
}
