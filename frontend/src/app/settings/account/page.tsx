'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppShell, BackHeader, Button, Card } from '@/components/ui';
import { errorText } from '@/services/api';
import { accountApi, passwordApi } from '@/services/endpoints';
import { useAuth } from '@/stores/auth';

const PW = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

/** 계정 · 비밀번호 바꾸기 (간편 로그인 계정은 아이디·비밀번호 만들기) */
export default function AccountPage() {
  const router = useRouter();
  const setTokens = useAuth((s) => s.setTokens);
  const ids = useQuery({ queryKey: ['identities'], queryFn: accountApi.identities });
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [loginId, setLoginId] = useState('');
  const hasId = !!ids.data?.loginId;
  const m = useMutation({
    mutationFn: () => passwordApi.change({ current: cur || undefined, next, loginId: hasId ? undefined : loginId }),
    onSuccess: (t) => (setTokens(t), router.replace('/settings')),
  });
  const ok = PW.test(next) && next === again && (hasId || /^[a-z0-9]{4,20}$/.test(loginId));
  const field = 'min-h-[52px] rounded-[14px] border-2 border-line px-3.5 font-normal outline-none focus:border-brand';
  return (
    <AppShell tabs={false}>
      <BackHeader title={hasId ? '비밀번호 바꾸기' : '아이디·비밀번호 만들기'} href="/settings" />
      <form className="flex flex-col gap-3 px-5 pt-3" onSubmit={(e) => (e.preventDefault(), ok && m.mutate())}>
        <Card className="flex flex-col gap-3">
          {!hasId && (
            <label className="flex flex-col gap-1 text-sm font-bold">
              새 아이디
              <input value={loginId} onChange={(e) => setLoginId(e.target.value.trim().toLowerCase())} autoComplete="username" className={field} placeholder="영문 소문자·숫자 4~20자" />
            </label>
          )}
          {hasId && (
            <label className="flex flex-col gap-1 text-sm font-bold">
              지금 비밀번호
              <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" className={field} />
              <span className="text-xs font-normal text-muted">카카오·구글로 방금 로그인했다면 비워 둬도 돼요</span>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-bold">
            새 비밀번호
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={field} />
            <span className={next && !PW.test(next) ? 'text-xs font-normal text-coral-ink' : 'text-xs font-normal text-muted'}>8자 이상, 영문과 숫자를 넣어요</span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            한 번 더
            <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" className={field} />
            {again && again !== next && <span className="text-xs font-normal text-coral-ink">두 비밀번호가 달라요</span>}
          </label>
        </Card>
        {m.error && <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-bold text-coral-ink">{errorText(m.error)}</p>}
        <p className="text-xs text-muted">바꾸면 다른 기기에서는 다시 로그인해야 해요.</p>
        <Button type="submit" disabled={!ok || m.isPending}>
          저장하기
        </Button>
      </form>
    </AppShell>
  );
}
