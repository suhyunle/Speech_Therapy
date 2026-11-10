'use client';
import { useQuery } from '@tanstack/react-query';
import { AppShell, BackHeader, Button, Card } from '@/components/ui';
import { authApi } from '@/services/endpoints';

/**
 * 비밀번호를 잊었을 때: 이메일·문자 발송 수단이 없어서, 계정에 연결한 카카오·구글로 들어온 뒤 새 비밀번호를 만든다.
 * (디자인 IdLogin 의 ‘비밀번호를 잊었어요’)
 */
export default function ForgotPage() {
  const p = useQuery({ queryKey: ['providers'], queryFn: authApi.providers });
  const go = async (x: 'kakao' | 'google') => {
    sessionStorage.setItem('malang-after-login', '/settings/account');
    const { url } = await authApi.oauthUrl(x);
    window.location.href = url;
  };
  const any = p.data && (p.data.kakao || p.data.google);
  return (
    <AppShell nav={false} tabs={false}>
      <BackHeader title="비밀번호를 잊었어요" href="/login/id" />
      <div className="flex flex-col gap-3 px-5 pt-3">
        <h1 className="px-1 font-jua text-[26px] leading-tight">연결한 간편 로그인으로 들어와서 새로 만들어요</h1>
        <Card className="flex flex-col gap-2 text-sm leading-relaxed text-sub">
          <span>1. 아이디 계정에 연결해 둔 카카오나 구글로 로그인해요.</span>
          <span>2. 들어오면 바로 ‘비밀번호 바꾸기’ 화면이 열려요. 지금 비밀번호 없이 새로 만들 수 있어요.</span>
        </Card>
        {p.data?.kakao && (
          <button type="button" onClick={() => go('kakao')} className="min-h-[56px] rounded-[20px] bg-kakao font-bold text-ink">
            카카오로 들어가기
          </button>
        )}
        {p.data?.google && (
          <button type="button" onClick={() => go('google')} className="min-h-[56px] rounded-[20px] border-2 border-line bg-white font-bold">
            구글로 들어가기
          </button>
        )}
        {p.data && !any && <p className="rounded-2xl bg-coral-soft px-4 py-3 text-sm text-coral-ink">이 서버에는 간편 로그인이 아직 설정되지 않았어요. 관리자에게 비밀번호 초기화를 요청해 주세요.</p>}
        <p className="text-xs leading-relaxed text-muted">간편 로그인을 연결하지 않은 아이디 계정은 지금은 스스로 되찾을 수 없어요. 이메일·문자 인증은 아직 없어요.</p>
        <Button variant="ghost" href="/login/id">
          로그인으로 돌아가기
        </Button>
      </div>
    </AppShell>
  );
}
