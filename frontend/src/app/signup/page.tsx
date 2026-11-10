'use client';
import { useEffect, useState } from 'react';
import { BackHeader, Button, cx } from '@/components/ui';
import { Field } from '@/features/auth/Field';
import { useAfterLogin } from '@/features/auth/useAfterLogin';
import { errorText } from '@/services/api';
import { authApi } from '@/services/endpoints';
import { useAuth } from '@/stores/auth';

const ID_RULE = /^[a-z0-9_]{4,20}$/;

/** 디자인: SignUp · 입력 검사 (아이디 중복 즉시 표시, 비밀번호 규칙 3개, 확인 일치) */
export default function SignUpPage() {
  const after = useAfterLogin();
  const isGuest = useAuth((s) => s.user?.isGuest);
  const [loginId, setLoginId] = useState('');
  const [idState, setIdState] = useState<'idle' | 'ok' | 'taken' | 'format'>('idle');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [agree, setAgree] = useState(false);
  const [guardian, setGuardian] = useState({ name: '', contact: '', agree: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loginId) return setIdState('idle');
    if (!ID_RULE.test(loginId)) return setIdState('format');
    const t = setTimeout(() => authApi.checkId(loginId).then((r) => setIdState(r.available ? 'ok' : 'taken')).catch(() => setIdState('idle')), 350);
    return () => clearTimeout(t);
  }, [loginId]);

  const rules = [
    { label: '8자 이상', ok: pw.length >= 8 },
    { label: '영문 포함', ok: /[A-Za-z]/.test(pw) },
    { label: '숫자 포함', ok: /\d/.test(pw) },
  ];
  const by = Number(birthYear);
  const under14 = birthYear.length === 4 && new Date().getFullYear() - by - 1 < 14;
  const pwOk = rules.every((r) => r.ok);
  const matchOk = pw2.length > 0 && pw === pw2;
  const guardianOk = !under14 || (guardian.name && guardian.contact && guardian.agree);
  const ready = idState === 'ok' && pwOk && matchOk && name.trim() && agree && guardianOk;
  const blocker = idState !== 'ok' ? '아이디를 확인해 주세요' : !pwOk ? '비밀번호 규칙을 맞춰주세요' : !matchOk ? '비밀번호를 맞춰주세요' : !name.trim() ? '이름을 적어주세요' : !agree ? '약관에 동의해 주세요' : !guardianOk ? '보호자 동의가 필요해요' : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      after(
        await authApi.signup({
          loginId,
          password: pw,
          name: name.trim(),
          agreeTerms: agree,
          ...(birthYear ? { birthYear: by } : {}),
          ...(under14 ? { guardianName: guardian.name, guardianContact: guardian.contact, guardianAgree: guardian.agree } : {}),
        }),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-bg">
      <BackHeader title="회원가입" />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4 px-6 pb-8 pt-2">
        <h1 className="font-jua text-[28px]">아이디를 만들어요</h1>
        {isGuest && <p className="rounded-2xl bg-pass-soft px-4 py-3 text-sm font-bold text-pass-ink">지금까지 한 진단 기록을 그대로 이어서 저장해요</p>}
        <Field
          label="아이디"
          value={loginId}
          onChange={(v) => setLoginId(v.toLowerCase())}
          autoComplete="username"
          maxLength={20}
          hint={idState === 'ok' ? '쓸 수 있는 아이디예요' : idState === 'taken' ? '이미 쓰고 있는 아이디예요' : idState === 'format' ? '영문 소문자·숫자 4~20자로 만들어요' : undefined}
          hintTone={idState === 'ok' ? 'ok' : idState === 'idle' ? undefined : 'bad'}
        />
        <div className="flex flex-col gap-2">
          <Field label="비밀번호" type="password" value={pw} onChange={setPw} autoComplete="new-password" />
          <div className="flex gap-2">
            {rules.map((r) => (
              <span key={r.label} className={cx('rounded-full px-2.5 py-1 text-xs font-bold', r.ok ? 'bg-pass-soft text-pass-ink' : 'bg-white text-muted')}>
                {r.ok ? '✓ ' : ''}
                {r.label}
              </span>
            ))}
          </div>
        </div>
        <Field label="비밀번호 확인" type="password" value={pw2} onChange={setPw2} autoComplete="new-password" hint={pw2 && !matchOk ? '! 위 비밀번호와 달라요' : undefined} hintTone={pw2 && !matchOk ? 'bad' : undefined} />
        <Field label="이름 (앱에서 불러드릴 이름)" value={name} onChange={setName} maxLength={30} />
        <Field label="태어난 해 (선택 · 만 14세 미만 확인용)" value={birthYear} onChange={(v) => setBirthYear(v.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" />
        {under14 && (
          <fieldset className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-chip">
            <legend className="sr-only">보호자 동의</legend>
            <b className="text-sm">만 14세 미만은 보호자 동의가 필요해요</b>
            <Field label="보호자 이름" value={guardian.name} onChange={(v) => setGuardian({ ...guardian, name: v })} maxLength={30} />
            <Field label="보호자 연락처" value={guardian.contact} onChange={(v) => setGuardian({ ...guardian, contact: v })} maxLength={100} />
            <label className="flex min-h-[44px] items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-brand" checked={guardian.agree} onChange={(e) => setGuardian({ ...guardian, agree: e.target.checked })} />
              보호자가 개인정보 수집·이용에 동의해요
            </label>
          </fieldset>
        )}
        <label className="flex min-h-[44px] items-center gap-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-brand" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            <b>(필수)</b> 이용약관 · 개인정보 처리방침 동의
          </span>
        </label>
        {error && (
          <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-bold text-coral-ink">
            {error}
          </p>
        )}
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <Button type="submit" disabled={!ready || busy}>
            {ready ? '가입하기' : blocker}
          </Button>
          {!ready && <span className="text-center text-xs text-muted">다 맞으면 버튼이 “가입하기”로 바뀌어요</span>}
        </div>
      </form>
    </main>
  );
}
