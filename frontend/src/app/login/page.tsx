'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { BackHeader, Button, Logo, Mascot } from '@/components/ui';
import { Field } from '@/features/auth/Field';
import { useAfterLogin } from '@/features/auth/useAfterLogin';
import { HttpError, errorText } from '@/services/api';
import { authApi } from '@/services/endpoints';

/** 디자인: Login · 카카오 / 구글 / 아이디 (휴대폰) + WebLogin (넓은 화면: 소개 + 아이디 입력 함께) */
export default function LoginPage() {
  const after = useAfterLogin();
  const providers = useQuery({ queryKey: ['providers'], queryFn: authApi.providers });
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');

  const oauth = async (p: 'kakao' | 'google') => {
    if (!providers.data?.[p]) return setToast(`${p === 'kakao' ? '카카오' : 'Google'} 로그인은 준비 중이에요. 아이디로 시작해 주세요`);
    try {
      window.location.href = (await authApi.oauthUrl(p)).url;
    } catch (e) {
      setToast(errorText(e));
    }
  };
  const guest = async () => {
    setBusy(true);
    try {
      after(await authApi.guest());
    } catch (e) {
      setToast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const idLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      after(await authApi.login(loginId.trim(), password));
    } catch (err) {
      setToast(err instanceof HttpError && err.body.attempts ? `${err.message} (${err.body.attempts}/${err.body.max})` : errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh bg-bg lg:grid lg:grid-cols-[1.1fr_1fr]">
      <section aria-hidden className="hidden flex-col justify-between bg-brand p-14 text-white lg:flex">
        <span className="flex items-center gap-2 font-jua text-[24px]">
          말랑말랑 <span className="text-sm font-sans font-bold text-brand-light">ship and giggle</span>
        </span>
        <div className="flex flex-col gap-6">
          <h1 className="font-jua text-[52px] leading-tight">
            귀 대신 눈으로
            <br />내 발음을 확인해요
          </h1>
          <div className="flex w-[360px] flex-col gap-1 rounded-[24px] bg-ink px-5 py-4">
            <span className="text-xs font-bold text-[#C8C5DD]">들린 대로 · 보정 없이</span>
            <span className="font-jua text-[44px]">
              <span className="rounded-md bg-coral px-1 text-ink">다</span> 과
            </span>
          </div>
        </div>
        <span className="text-brand-light">앱에서 한 연습이 웹에도 그대로 이어져요</span>
      </section>
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col lg:max-w-[440px] lg:justify-center">
        <div className="lg:hidden">
          <BackHeader href="/welcome" />
        </div>
        <div className="flex flex-1 flex-col justify-center gap-3.5 px-7 lg:flex-none lg:pb-6">
          <span className="lg:hidden">
            <Mascot size={88} className="mallang" />
          </span>
          <span className="hidden lg:block">
            <Logo size={26} />
          </span>
          <h1 className="font-jua text-[32px] leading-tight">
            말랑말랑
            <br className="lg:hidden" /> 시작하기
          </h1>
          <p className="text-[15px] leading-relaxed text-sub lg:hidden">
            로그인하면 내 진단과 녹음 기록이
            <br />
            휴대폰과 웹에서 그대로 이어져요.
          </p>
        </div>
        <div className="flex flex-col gap-3 px-6 pb-7">
          {toast && (
            <p role="status" className="rounded-2xl bg-ink px-4 py-3 text-center text-sm text-white">
              {toast}
            </p>
          )}
          <Button variant="kakao" onClick={() => oauth('kakao')}>
            카카오로 시작하기
          </Button>
          <Button variant="google" onClick={() => oauth('google')}>
            Google로 시작하기
          </Button>
          <Button variant="dark" href="/login/id" className="lg:hidden">
            아이디로 로그인
          </Button>
          <form onSubmit={idLogin} className="hidden flex-col gap-3 lg:flex">
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-grow bg-line" />
              또는 아이디로
              <span className="h-px flex-grow bg-line" />
            </div>
            <Field label="아이디" value={loginId} onChange={setLoginId} autoComplete="username" />
            <Field label="비밀번호" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
            <Button type="submit" variant="dark" disabled={busy || !loginId || !password}>
              로그인
            </Button>
            <div className="flex justify-between text-sm">
              <Link href="/signup" className="font-bold text-brand-dark">
                아이디 만들기
              </Link>
              <Link href="/forgot" className="text-muted">
                비밀번호를 잊었어요
              </Link>
            </div>
          </form>
          <div className="flex items-center justify-center gap-1.5 text-sm text-sub lg:hidden">
            처음이세요?
            <Link href="/signup" className="flex min-h-[44px] items-center font-bold text-brand-dark">
              아이디로 회원가입
            </Link>
          </div>
          <Button variant="ghost" onClick={guest} disabled={busy}>
            로그인 없이 진단만 먼저 해보기
          </Button>
          <p className="text-center text-xs leading-relaxed text-muted">
            시작하면 <Link href="/terms" className="text-sub underline">이용약관</Link>과 <Link href="/privacy" className="text-sub underline">개인정보 처리방침</Link>에
            <br />
            동의하는 것으로 봐요.
          </p>
        </div>
      </div>
    </main>
  );
}
