'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { attemptsApi } from '@/services/endpoints';
import { notifyQueueChanged, offlineQueue } from '@/utils/offline';
import { HttpError } from '@/services/api';
import { useAuth } from '@/stores/auth';

const PUBLIC = ['/', '/welcome', '/tutorial', '/login', '/login/id', '/signup', '/auth/callback', '/l/', '/privacy', '/terms', '/offline', '/forgot'];

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: (n, e) => !(e instanceof HttpError && e.status < 500 && e.status > 0) && n < 2, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <OfflineManager />
      <AuthGate>{children}</AuthGate>
    </QueryClientProvider>
  );
}

/** 로그인 필요한 화면은 로그인 화면으로 보낸다 */
function AuthGate({ children }: { children: ReactNode }) {
  const { hydrated, accessToken } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC.some((p) => (p.endsWith('/') && p !== '/' ? path.startsWith(p) : path === p || path.startsWith(p + '/')));
  useEffect(() => {
    if (hydrated && !accessToken && !isPublic) router.replace('/login');
  }, [hydrated, accessToken, isPublic, router]);
  if (!hydrated && !isPublic) return null;
  if (!accessToken && !isPublic) return null;
  return <>{children}</>;
}

/** 보관해 둔 녹음을 연결되면 자동으로 올리고, 끊겼을 때는 위쪽 띠로 알린다 (WebStates · Offline) */
function OfflineManager() {
  const qc = useQueryClient();
  const token = useAuth((s) => s.accessToken);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    const count = () => offlineQueue.list().then((l) => setPending(l.filter((p) => !p.attemptId).length)).catch(() => undefined);
    const flush = async () => {
      if (!navigator.onLine || !useAuth.getState().accessToken) return;
      const list = await offlineQueue.list().catch(() => []);
      for (const p of list) {
        if (p.attemptId) continue;
        try {
          const a = await attemptsApi.create(p.wav, { ...p.meta, clientId: p.clientId });
          await offlineQueue.update({ ...p, attemptId: a.id });
        } catch {
          break; // 아직 연결 안 됨 · 다음에 다시
        }
      }
      void qc.invalidateQueries({ queryKey: ['plan'] });
      notifyQueueChanged();
    };
    const on = () => (setOnline(true), void flush());
    const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('malang-offline', count);
    void count();
    void flush();
    const iv = setInterval(flush, 30_000);
    return () => (window.removeEventListener('online', on), window.removeEventListener('offline', off), window.removeEventListener('malang-offline', count), clearInterval(iv));
  }, [qc, token]);
  if (online && pending === 0) return null;
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-ink px-4 py-2.5 text-[13px] text-white">
      <span>{online ? `녹음 ${pending}개를 올리는 중이에요` : `인터넷이 끊겼어요${pending ? ` · 녹음 ${pending}개는 이 기기에 보관 중` : ''} · 다시 연결되면 바로 분석해요`}</span>
      <a href="/offline" className="shrink-0 rounded-full bg-white/15 px-3 py-1 font-bold">보기</a>
    </div>
  );
}
