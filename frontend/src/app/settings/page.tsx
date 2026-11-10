'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell, Button, Card, ErrorState, Loading, Sheet, cx } from '@/components/ui';
import { RetentionPicker, Toggle } from '@/features/settings/Toggle';
import { errorText } from '@/services/api';
import { accountApi, authApi, emailApi, meApi, notifyApi } from '@/services/endpoints';
import { disablePush, enablePush, pushSupported } from '@/services/push';
import { useAuth } from '@/stores/auth';
import type { Settings } from '@/types/api';

const Row = ({ href, label, right }: { href: string; label: string; right?: string }) => (
  <Link href={href} className="flex min-h-[56px] items-center justify-between gap-2 px-4 text-[15px] font-bold">
    {label}
    <span className="flex items-center gap-2 text-sm font-normal text-muted">
      {right}
      <span className="text-faint">›</span>
    </span>
  </Link>
);

/** 디자인: Settings · WebSettings */
export default function SettingsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user, refreshToken, clear } = useAuth();
  const s = useQuery({ queryKey: ['settings'], queryFn: meApi.settings });
  const vm = useQuery({ queryKey: ['voice-model'], queryFn: accountApi.voiceModel, enabled: !!user && !user.isGuest });
  const ids = useQuery({ queryKey: ['identities'], queryFn: accountApi.identities, enabled: !!user && !user.isGuest });
  const providers = useQuery({ queryKey: ['providers'], queryFn: authApi.providers });
  const save = useMutation({ mutationFn: (b: Partial<Settings>) => meApi.updateSettings(b), onSuccess: (d) => (qc.setQueryData(['settings'], d), qc.invalidateQueries({ queryKey: ['plan'] })) });
  const [confirm, setConfirm] = useState<'recordings' | 'account' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pushState, setPushState] = useState<'unknown' | 'on' | 'off' | 'unsupported'>('unknown');

  useEffect(() => {
    if (s.data) document.documentElement.dataset.font = s.data.fontSize;
  }, [s.data]);
  useEffect(() => {
    if (!pushSupported()) return setPushState('unsupported');
    void navigator.serviceWorker.getRegistration().then(async (r) => setPushState((await r?.pushManager.getSubscription()) ? 'on' : 'off'));
  }, []);

  const reminder = async (v: boolean) => {
    save.mutate({ reminderEnabled: v, reminderTime: s.data?.reminderTime ?? '20:00' });
    if (v) {
      const r = await enablePush().catch((e) => ({ ok: false, reason: errorText(e) }));
      setPushState(r.ok ? 'on' : pushSupported() ? 'off' : 'unsupported');
      if (!r.ok) setMsg(`알림 시간은 저장했어요. ${r.reason ?? ''} 그래서 이 기기로는 아직 못 보내요.`);
    } else {
      await disablePush();
      setPushState('off');
    }
  };
  const testPush = async () => {
    try {
      const r = await notifyApi.test();
      setMsg(r.sent ? `시험 알림을 ${r.sent}개 기기로 보냈어요` : '알림을 받을 기기가 없어요. 알림을 켜 주세요');
    } catch (e) {
      setMsg(errorText(e));
    }
  };
  const link = async (p: 'kakao' | 'google') => {
    try {
      const { url } = await accountApi.linkUrl(p);
      window.location.href = url;
    } catch (e) {
      setMsg(errorText(e));
    }
  };
  const logout = async () => {
    if (refreshToken) await authApi.logout(refreshToken).catch(() => undefined);
    clear();
    qc.clear();
    router.replace('/');
  };
  const doDelete = async () => {
    try {
      if (confirm === 'recordings') {
        const r = await meApi.deleteRecordings();
        setMsg(`녹음 원본 ${r.deleted}개를 지웠어요. 결과 글자는 남아요.`);
      } else {
        await meApi.deleteAccount();
        clear();
        qc.clear();
        router.replace('/');
      }
    } catch (e) {
      setMsg(errorText(e));
    }
    setConfirm(null);
  };
  const linked = (p: 'KAKAO' | 'GOOGLE') => ids.data?.providers.find((x) => x.provider === p);

  return (
    <AppShell wide>
      <header className="px-6 pt-[max(env(safe-area-inset-top),24px)] md:pt-6 lg:px-0">
        <h1 className="font-jua text-[28px] lg:text-[32px]">설정</h1>
        {user && <span className="text-sm text-sub">{user.isGuest ? '손님 모드 · 기록이 이 기기에만 묶여 있어요' : `${user.name} · ${user.loginId ?? '간편 로그인'}`}</span>}
      </header>
      {s.isLoading && <Loading />}
      {s.error && <ErrorState message={errorText(s.error)} onRetry={() => s.refetch()} />}
      {msg && (
        <p role="status" className="mx-5 mt-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white lg:mx-0">
          {msg}
        </p>
      )}
      {s.data && (
        <div className="grid gap-3 px-5 pb-8 pt-4 lg:grid-cols-2 lg:items-start lg:px-0">
          <div className="flex flex-col gap-3">
            <Card className="flex flex-col gap-2.5">
              <b className="text-sm">학습 · 하루 목표</b>
              <div role="radiogroup" className="grid grid-cols-3 gap-2">
                {([3, 5, 10] as const).map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={s.data.dailyGoal === n} onClick={() => save.mutate({ dailyGoal: n })} className={cx('flex min-h-[60px] flex-col items-center justify-center rounded-2xl', s.data.dailyGoal === n ? 'bg-brand text-white shadow-[0_3px_0_#3F31D6]' : 'bg-bg text-sub')}>
                    <span className="font-jua text-[20px]">하루 {n}개</span>
                    <span className="text-[11px]">약 {n === 3 ? 2 : n === 5 ? 5 : 10}분</span>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="flex flex-col">
              <Toggle label="연습 알림" desc={s.data.reminderEnabled && s.data.reminderTime ? `매일 ${s.data.reminderTime}` : undefined} on={s.data.reminderEnabled} onChange={reminder} />
              {s.data.reminderEnabled && (
                <>
                  <label className="flex min-h-[52px] items-center justify-between text-[15px] font-bold">
                    알림 시간
                    <input type="time" value={s.data.reminderTime ?? '20:00'} onChange={(e) => save.mutate({ reminderTime: e.target.value })} className="rounded-xl bg-bg px-3 py-2 font-normal" />
                  </label>
                  <div className="flex items-center justify-between gap-2 pb-2 text-xs">
                    <span className={pushState === 'on' ? 'text-pass-text' : 'text-coral-ink'}>
                      {pushState === 'on' ? '이 기기로 알림을 받아요' : pushState === 'unsupported' ? '이 브라우저는 알림을 지원하지 않아요 (아이폰은 홈 화면에 추가한 앱에서만 돼요)' : '이 기기는 아직 알림을 받지 않아요'}
                    </span>
                    {pushState === 'on' ? (
                      <button type="button" onClick={testPush} className="min-h-[36px] shrink-0 rounded-xl bg-bg px-3 font-bold text-brand-dark">
                        시험 알림
                      </button>
                    ) : (
                      pushState === 'off' && (
                        <button type="button" onClick={() => reminder(true)} className="min-h-[36px] shrink-0 rounded-xl bg-bg px-3 font-bold text-brand-dark">
                          이 기기에서 받기
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
              <Toggle label="진동과 화면으로 알리기" desc="소리 대신 진동 + 화면 깜빡임" on={s.data.visualAlert} onChange={(v) => save.mutate({ visualAlert: v })} />
              <Toggle label="진동으로 소리 느끼기" desc="안드로이드 브라우저에서만 진동해요" on={s.data.haptics} onChange={(v) => save.mutate({ haptics: v })} />
              <Toggle label="큰 글자" desc="본문 18px" on={s.data.fontSize === 'LARGE'} onChange={(v) => save.mutate({ fontSize: v ? 'LARGE' : 'NORMAL' })} />
            </Card>
            <Card className="flex flex-col divide-y-2 divide-line p-0">
              <Row href="/placement" label="진단 다시 하기" />
              <Row href="/start" label="기준 목소리 다시 잡기" />
              {!user?.isGuest && <Row href="/settings/voice-model" label="내 목소리에 맞추기" right={vm.data ? `${Math.min(vm.data.recordings, vm.data.goal)}/${vm.data.goal}` : undefined} />}
              {!user?.isGuest && <Row href="/settings/research" label="연구 모드 · 기록 내보내기" right={s.data.researchMode ? '켜짐' : undefined} />}
              {user?.role === 'ADMIN' && <Row href="/admin" label="관리자 · 단어와 문장 관리" />}
            </Card>
          </div>
          <div className="flex flex-col gap-3">
            {user?.isGuest ? (
              <Card className="flex flex-col gap-2">
                <b className="text-sm">계정</b>
                <span className="text-sm text-sub">가입하면 앱과 웹에서 기록이 함께 저장돼요. 지금까지 한 연습도 그대로 옮겨요.</span>
                <Button href="/signup">가입하고 기록 저장하기</Button>
              </Card>
            ) : (
              <Card className="flex flex-col gap-2">
                <b className="text-sm">계정 · 앱과 웹 연결</b>
                <span className="text-xs text-muted">같은 계정으로 들어오면 앱과 웹 기록이 함께 저장돼요</span>
                {ids.data?.loginId && (
                  <div className="flex min-h-[48px] items-center justify-between rounded-xl bg-bg px-3 text-sm">
                    <span>아이디 · {ids.data.loginId}</span>
                    <span className="text-xs font-bold text-pass-text">연결됨</span>
                  </div>
                )}
                {(['KAKAO', 'GOOGLE'] as const).map((p) => {
                  const l = linked(p);
                  const name = p === 'KAKAO' ? '카카오' : '구글';
                  const enabled = providers.data?.[p === 'KAKAO' ? 'kakao' : 'google'];
                  return (
                    <div key={p} className="flex min-h-[48px] items-center justify-between rounded-xl bg-bg px-3 text-sm">
                      <span>
                        {name}
                        {l?.email ? ` · ${l.email}` : ''}
                      </span>
                      {l ? (
                        <span className="text-xs font-bold text-pass-text">연결됨</span>
                      ) : enabled ? (
                        <button type="button" onClick={() => link(p === 'KAKAO' ? 'kakao' : 'google')} className="min-h-[36px] rounded-lg bg-white px-3 text-xs font-bold text-brand-dark">
                          연결하기
                        </button>
                      ) : (
                        <span className="text-xs text-muted">서버 설정 전</span>
                      )}
                    </div>
                  );
                })}
                <EmailRow current={ids.data?.email ?? null} verified={!!ids.data?.emailVerified} enabled={!!providers.data?.email} onSent={(e) => setMsg(`${e}로 인증 메일을 보냈어요. 메일의 링크를 누르면 끝나요.`)} />
                <Link href="/settings/account" className="text-sm font-bold text-brand-dark">
                  {ids.data?.loginId ? '비밀번호 바꾸기' : '아이디·비밀번호 만들기'} ›
                </Link>
              </Card>
            )}
            <Card className="flex flex-col gap-2">
              <b className="text-sm">개인정보 · 녹음</b>
              <RetentionPicker value={s.data.retentionDays} onChange={(v) => save.mutate({ retentionDays: v })} />
              <Button variant="outline" className="mt-1" onClick={() => setConfirm('recordings')}>
                내 녹음 원본 전부 지우기
              </Button>
              <div className="flex gap-3 pt-1 text-xs text-muted">
                <Link href="/privacy">개인정보 처리방침</Link>
                <Link href="/terms">이용약관</Link>
              </div>
            </Card>
            {!user?.isGuest && (
              <Button variant="outline" onClick={logout}>
                로그아웃
              </Button>
            )}
            <Button variant="ghost" className="text-coral-ink" onClick={() => setConfirm('account')}>
              계정과 녹음 모두 지우기
            </Button>
          </div>
        </div>
      )}
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} label="삭제 확인">
        <b className="font-jua text-[22px]">{confirm === 'recordings' ? '녹음 원본을 모두 지울까요?' : '계정을 삭제할까요?'}</b>
        <p className="text-sm text-sub">{confirm === 'recordings' ? '되돌릴 수 없어요. 결과 글자와 측정값은 남고, 다시 들을 수 없게 돼요.' : '되돌릴 수 없어요. 진단·녹음·기록이 모두 지워져요.'}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setConfirm(null)}>
            그만두기
          </Button>
          <Button className="bg-coral shadow-[0_5px_0_#D9481A]" onClick={doDelete}>
            지우기
          </Button>
        </div>
      </Sheet>
    </AppShell>
  );
}

/** 이메일 등록 · 인증 (비밀번호를 잊었을 때 재설정 링크를 받는 곳) */
function EmailRow({ current, verified, enabled, onSent }: { current: string | null; verified: boolean; enabled: boolean; onSent: (email: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await emailApi.set(v);
      setEdit(false);
      onSent(r.email);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  if (!enabled)
    return (
      <div className="flex min-h-[48px] items-center justify-between rounded-xl bg-bg px-3 text-sm">
        <span>이메일</span>
        <span className="text-xs text-muted">서버 메일 설정 전</span>
      </div>
    );
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-bg p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">이메일{current ? ` · ${current}` : ''}</span>
        {current && verified ? <span className="shrink-0 text-xs font-bold text-pass-text">인증됨</span> : current ? <span className="shrink-0 text-xs font-bold text-coral-ink">인증 전</span> : null}
        {!edit && (
          <button type="button" onClick={() => (setEdit(true), setV(current ?? ''))} className="min-h-[36px] shrink-0 rounded-lg bg-white px-3 text-xs font-bold text-brand-dark">
            {current ? (verified ? '바꾸기' : '다시 보내기') : '등록하기'}
          </button>
        )}
      </div>
      {edit && (
        <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), void send())}>
          <input type="email" value={v} onChange={(e) => setV(e.target.value)} placeholder="name@example.com" className="min-h-[44px] min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-3 outline-none focus:border-brand" />
          <button type="submit" disabled={busy || !v.includes('@')} className="min-h-[44px] shrink-0 rounded-xl bg-brand px-3 text-xs font-bold text-white disabled:bg-line2">
            인증 메일 보내기
          </button>
        </form>
      )}
      {err && <span className="text-xs text-coral-ink">{err}</span>}
      <span className="text-[11px] text-muted">비밀번호를 잊었을 때 이 메일로 재설정 링크를 보내요. 다른 곳에는 쓰지 않아요.</span>
    </div>
  );
}
