'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Landing } from '@/features/marketing/Landing';
import { useAuth } from '@/stores/auth';

/**
 * 첫 주소: 로그인했으면 학습으로, 휴대폰 앱(홈 화면에 추가)으로 열었으면 스플래시·소개,
 * 그 밖에는 웹 랜딩페이지 (디자인 Landing).
 */
export default function RootPage() {
  const { hydrated, accessToken, user } = useAuth();
  const router = useRouter();
  const [landing, setLanding] = useState(false);
  useEffect(() => {
    if (!hydrated) return;
    if (accessToken) return router.replace(user?.onboarded ? '/home' : '/start');
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || new URLSearchParams(location.search).has('app');
    if (standalone) router.replace('/welcome?app=1');
    else setLanding(true);
  }, [hydrated, accessToken, user, router]);
  return landing ? <Landing /> : <div className="min-h-dvh bg-bg" />;
}
