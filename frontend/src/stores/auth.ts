'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser, TokenPair } from '@/types/api';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: PublicUser | null;
  hydrated: boolean;
  setTokens: (t: TokenPair) => void;
  setUser: (u: PublicUser) => void;
  clear: () => void;
  setHydrated: () => void;
}

/** 로그인 상태. 리프레시 토큰은 이 기기 localStorage에 보관 (앱과 웹이 같은 계정으로 이어짐) */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      hydrated: false,
      setTokens: (t) => set({ accessToken: t.accessToken, refreshToken: t.refreshToken, user: t.user }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'malang-auth',
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, user: s.user }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
