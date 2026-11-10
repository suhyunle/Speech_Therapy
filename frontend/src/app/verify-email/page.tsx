'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AppShell, Button, Loading, Mascot } from '@/components/ui';
import { errorText } from '@/services/api';
import { emailApi } from '@/services/endpoints';
import { useAuth } from '@/stores/auth';

function Verify() {
  const token = useSearchParams().get('token');
  const logged = useAuth((s) => !!s.accessToken);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) return setState({ ok: false, text: '링크가 올바르지 않아요' });
    emailApi
      .verify(token)
      .then((r) => setState({ ok: true, text: `${r.email} 인증이 끝났어요. 이제 비밀번호를 잊어도 이 메일로 다시 만들 수 있어요.` }))
      .catch((e) => setState({ ok: false, text: errorText(e) }));
  }, [token]);
  if (!state) return <Loading text="이메일을 확인하는 중이에요" />;
  return (
    <div className="flex flex-1 flex-col items-center gap-3 px-6 pt-20 text-center">
      <Mascot size={96} mood={state.ok ? 'happy' : 'calm'} />
      <h1 className="font-jua text-[26px]">{state.ok ? '이메일 인증 완료!' : '인증하지 못했어요'}</h1>
      <p className="text-sm leading-relaxed text-sub">{state.text}</p>
      <div className="mt-6 w-full">
        <Button href={logged ? '/settings' : '/login'}>{logged ? '설정으로' : '로그인하기'}</Button>
      </div>
    </div>
  );
}

/** 이메일 인증 링크가 열리는 곳 */
export default function VerifyEmailPage() {
  return (
    <AppShell nav={false} tabs={false}>
      <Suspense fallback={<Loading />}>
        <Verify />
      </Suspense>
    </AppShell>
  );
}
