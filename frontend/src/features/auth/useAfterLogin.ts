'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth';
import type { TokenPair } from '@/types/api';

/** 로그인 후: 시작 준비(마이크·진단)를 마쳤으면 홈, 아니면 시작 준비로 */
export function useAfterLogin() {
  const router = useRouter();
  const setTokens = useAuth((s) => s.setTokens);
  return (t: TokenPair) => {
    setTokens(t);
    router.replace(t.user.onboarded ? '/home' : '/start');
  };
}
