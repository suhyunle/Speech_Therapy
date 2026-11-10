'use client';
import Link from 'next/link';
import { useState } from 'react';
import { BackHeader, Button } from '@/components/ui';
import { Field } from '@/features/auth/Field';
import { useAfterLogin } from '@/features/auth/useAfterLogin';
import { HttpError, errorText } from '@/services/api';
import { authApi } from '@/services/endpoints';

/** 디자인: IdLogin · 오류 표시 (어느 쪽이 틀렸는지 밝히지 않음, 5번 틀리면 10분 잠금) */
export default function IdLoginPage() {
  const after = useAfterLogin();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      after(await authApi.login(loginId.trim(), password));
    } catch (err) {
      if (err instanceof HttpError && err.body.code === 'BAD_CREDENTIALS') {
        setError({ message: '아이디 또는 비밀번호가 맞지 않아요.', detail: err.body.attempts ? `5번 틀리면 10분 동안 로그인이 잠겨요. (${err.body.attempts}/${err.body.max})` : undefined });
      } else setError({ message: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-bg">
      <BackHeader href="/login" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4 px-6 pt-2">
        <h1 className="mb-2 font-jua text-[28px]">아이디로 로그인</h1>
        <Field label="아이디" value={loginId} onChange={setLoginId} autoComplete="username" invalid={!!error} />
        <Field label="비밀번호" type="password" value={password} onChange={setPassword} autoComplete="current-password" invalid={!!error} />
        {error && (
          <div role="alert" className="flex gap-2.5 rounded-2xl bg-coral-soft p-3.5 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coral font-bold text-ink">!</span>
            <span className="flex flex-col gap-1">
              <b className="text-coral-ink">{error.message}</b>
              {error.detail && <span className="text-sub">{error.detail}</span>}
            </span>
          </div>
        )}
        <div className="mt-auto flex flex-col gap-3 pb-7 pt-4">
          <Button type="submit" disabled={busy || !loginId || !password}>
            로그인
          </Button>
          <div className="flex items-center justify-center gap-3 text-sm text-muted">
            <Link href="/forgot" className="flex min-h-[44px] items-center">아이디·비밀번호 찾기</Link>|
            <Link href="/signup" className="flex min-h-[44px] items-center font-bold text-brand-dark">
              회원가입
            </Link>
          </div>
        </div>
      </form>
    </main>
  );
}
