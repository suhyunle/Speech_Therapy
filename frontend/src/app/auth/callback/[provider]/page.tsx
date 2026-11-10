'use client';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { ErrorState, Loading } from '@/components/ui';
import { useAfterLogin } from '@/features/auth/useAfterLogin';
import { errorText } from '@/services/api';
import { authApi } from '@/services/endpoints';
import { useAuth } from '@/stores/auth';

function Callback() {
  const { provider } = useParams<{ provider: 'kakao' | 'google' }>();
  const q = useSearchParams();
  const router = useRouter();
  const after = useAfterLogin();
  const [err, setErr] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = q.get('code');
    const state = q.get('state');
    if (!code || !state) return setErr('로그인이 취소됐어요');
    authApi
      .oauthCallback(provider, code, state)
      .then((t) => {
        // 비밀번호 찾기: 간편 로그인 뒤 바로 비밀번호 만들기 화면으로
        const next = sessionStorage.getItem('malang-after-login');
        sessionStorage.removeItem('malang-after-login');
        if (next && t.user.onboarded) {
          useAuth.getState().setTokens(t);
          router.replace(next);
          return;
        }
        return after(t);
      })
      .catch((e) => setErr(errorText(e)));
  }, [provider, q, after, router]);
  if (err) return <ErrorState message={err} onRetry={() => router.replace('/login')} />;
  return <Loading text="로그인하는 중이에요" />;
}

export default function OAuthCallbackPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-bg">
      <Suspense fallback={<Loading />}>
        <Callback />
      </Suspense>
    </main>
  );
}
