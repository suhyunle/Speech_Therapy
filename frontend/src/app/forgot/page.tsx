'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AppShell, BackHeader, Button, Card } from '@/components/ui';
import { errorText } from '@/services/api';
import { authApi, emailApi } from '@/services/endpoints';

/**
 * 비밀번호를 잊었을 때 (디자인 IdLogin 의 ‘비밀번호를 잊었어요’)
 * ① 인증한 이메일로 재설정 링크 받기  ② 연결한 카카오·구글로 들어와서 새로 만들기
 */
export default function ForgotPage() {
  const p = useQuery({ queryKey: ['providers'], queryFn: authApi.providers });
  const [id, setId] = useState('');
  const send = useMutation({ mutationFn: () => emailApi.forgot(id) });
  const go = async (x: 'kakao' | 'google') => {
    sessionStorage.setItem('malang-after-login', '/settings/account');
    const { url } = await authApi.oauthUrl(x);
    window.location.href = url;
  };
  const oauth = p.data && (p.data.kakao || p.data.google);
  return (
    <AppShell nav={false} tabs={false}>
      <BackHeader title="비밀번호를 잊었어요" href="/login/id" />
      <div className="flex flex-col gap-3 px-5 pt-3">
        <h1 className="px-1 font-jua text-[26px] leading-tight">새 비밀번호를 만들 수 있게 도와드릴게요</h1>
        {p.data?.email && (
          <Card className="flex flex-col gap-2">
            <b className="text-sm">이메일로 링크 받기</b>
            {send.data ? (
              <p role="status" className="rounded-xl bg-pass-soft px-3 py-3 text-sm leading-relaxed text-pass-ink">
                인증한 이메일이 있는 계정이면 30분 동안 쓸 수 있는 링크를 보냈어요. 메일함(스팸함도)을 확인해 주세요.
              </p>
            ) : (
              <form className="flex flex-col gap-2" onSubmit={(e) => (e.preventDefault(), id.trim() && send.mutate())}>
                <input value={id} onChange={(e) => setId(e.target.value)} placeholder="아이디 또는 인증한 이메일" autoComplete="username" className="min-h-[52px] rounded-[14px] border-2 border-line px-3.5 outline-none focus:border-brand" />
                <Button type="submit" disabled={!id.trim() || send.isPending}>
                  재설정 링크 받기
                </Button>
                {send.error && <span className="text-sm text-coral-ink">{errorText(send.error)}</span>}
              </form>
            )}
            <span className="text-xs text-muted">설정에서 이메일을 인증해 둔 계정만 받을 수 있어요.</span>
          </Card>
        )}
        {oauth && (
          <Card className="flex flex-col gap-2">
            <b className="text-sm">연결한 간편 로그인으로 들어오기</b>
            <span className="text-xs text-muted">들어오면 바로 비밀번호 바꾸기 화면이 열려요. 지금 비밀번호 없이 새로 만들 수 있어요.</span>
            {p.data?.kakao && (
              <button type="button" onClick={() => go('kakao')} className="min-h-[52px] rounded-[16px] bg-kakao font-bold text-ink">
                카카오로 들어가기
              </button>
            )}
            {p.data?.google && (
              <button type="button" onClick={() => go('google')} className="min-h-[52px] rounded-[16px] border-2 border-line bg-white font-bold">
                구글로 들어가기
              </button>
            )}
          </Card>
        )}
        {p.data && !p.data.email && !oauth && <p className="rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral-ink">이 서버에는 메일 발송과 간편 로그인이 아직 설정되지 않았어요. 관리자에게 비밀번호 초기화를 요청해 주세요.</p>}
        <Button variant="ghost" href="/login/id">
          로그인으로 돌아가기
        </Button>
      </div>
    </AppShell>
  );
}
