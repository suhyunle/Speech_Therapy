'use client';
import { AppShell, BackHeader } from '@/components/ui';
import { GoalPicker } from '@/features/onboarding/GoalPicker';

/** 디자인: GoalSetup · 하루 목표 정하기 */
export default function GoalPage() {
  return (
    <AppShell tabs={false}>
      <BackHeader title="마지막 단계" />
      <div className="px-6 pb-8 pt-2">
        <GoalPicker />
      </div>
    </AppShell>
  );
}
