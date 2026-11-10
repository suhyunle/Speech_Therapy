'use client';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AppShell, BackHeader, Button, Card, Loading } from '@/components/ui';
import { errorText } from '@/services/api';
import { emailApi } from '@/services/endpoints';

const PW = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;
const field = 'min-h-[52px] rounded-[14px] border-2 border-line px-3.5 font-normal outline-none focus:border-brand';

function Reset() {
  const token = useSearchParams().get('token') ?? '';
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [loginId, setLoginId] = useState('');
  const [needId, setNeedId] = useState(false);
  const m = useMutation({
    mutationFn: () => emailApi.reset(token, next, needId ? loginId : undefined),
    onError: (e) => errorText(e).includes('아이디도') && setNeedId(true),
  });
  if (m.data)
    return (
      <div className="flex flex-col gap-3 px-5 pt-6">
        <Card className="flex flex-col gap-1 bg-pass-soft shadow-none">
          <b className="font-jua text-[22px] text-pass-ink">새 비밀번호로 바꿨어요</b>
          <span className="text-sm text-pass-ink">아이디 {m.data.loginId}로 로그인해 주세요. 다른 기기에서는 로그아웃됐어요.</span>
        </Card>
        <Button href="/login/id">로그인하기</Button>
      </div>
    );
  const ok = PW.test(next) && next === again && (!needId || /^[a-z0-9]{4,20}$/.test(loginId));
  return (
    <form className="flex flex-col gap-3 px-5 pt-3" onSubmit={(e) => (e.preventDefault(), ok && m.mutate())}>
      <h1 className="px-1 font-jua text-[26px]">새 비밀번호를 만들어요</h1>
      <Card className="flex flex-col gap-3">
        {needId && (
          <label className="flex flex-col gap-1 text-sm font-bold">
            새 아이디
            <input value={loginId} onChange={(e) => setLoginId(e.target.value.trim().toLowerCase())} autoComplete="username" className={field} placeholder="영문 소문자·숫자 4~20자" />
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
      <Button type="submit" disabled={!ok || m.isPending || !token}>
        비밀번호 바꾸기
      </Button>
      {!token && <span className="text-center text-xs text-coral-ink">링크가 올바르지 않아요. 메일의 링크를 다시 눌러 주세요.</span>}
    </form>
  );
}

/** 이메일로 받은 비밀번호 재설정 링크 */
export default function ResetPasswordPage() {
  return (
    <AppShell nav={false} tabs={false}>
      <BackHeader title="비밀번호 다시 만들기" href="/login/id" />
      <Suspense fallback={<Loading />}>
        <Reset />
      </Suspense>
    </AppShell>
  );
}
