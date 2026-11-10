'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell, BackHeader, Button, Card, Icon, Mascot, Svg, cx } from '@/components/ui';
import { Qr } from '@/components/ui/Qr';
import { IssueBox, LiveBars, MicButton, useAttemptFlow } from '@/features/record/RecordPanel';
import { useRecorder } from '@/hooks/useRecorder';
import { errorText } from '@/services/api';
import { attemptsApi, meApi } from '@/services/endpoints';
import { localKv } from '@/utils/offline';

const STEPS = ['마이크 · 기준 목소리', '진단', '연습 순서', '하루 목표'];

/** 디자인: MicPermission → (MicDenied · WebMicError) → MicCheck (+ 웹: WebOnboarding 단계 표시) */
export default function StartPage() {
  const router = useRouter();
  const probe = useRecorder();
  const [step, setStep] = useState<'permission' | 'denied' | 'check'>('permission');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const allow = async () => {
    setBusy(true);
    setErr(null);
    try {
      await meApi.consent('VOICE_RECORDING', true);
      const ok = await probe.permission();
      setStep(ok ? 'check' : 'denied');
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'denied' || probe.state === 'unsupported') return <MicDenied unsupported={probe.state === 'unsupported'} onRetry={allow} />;

  if (step === 'permission')
    return (
      <AppShell tabs={false}>
        <div className="lg:hidden">
          <BackHeader href="/login" />
        </div>
        <Stepper at={0} />
        <div className="flex flex-1 flex-col justify-center gap-5 px-6 lg:max-w-[520px] lg:justify-start lg:pt-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-[30px] bg-brand-soft text-brand">
            <Svg size={48} stroke={2.4}>
              {Icon.mic}
            </Svg>
          </div>
          <h1 className="font-jua text-[30px] leading-tight">
            내 소리를 보려면
            <br />
            마이크가 필요해요
          </h1>
          <ul className="flex flex-col gap-2.5 text-[15px]">
            {['녹음은 발음을 확인하는 데만 써요', '카메라는 쓰지 않아요', '설정에서 언제든 끌 수 있어요'].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pass text-white">
                  <Svg size={14} stroke={3.4}>
                    {Icon.check}
                  </Svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
          <p className="rounded-2xl bg-white p-3.5 text-xs leading-relaxed text-sub">
            녹음 원본은 암호화해서 보관하고, 정해진 기간(기본 90일)이 지나면 자동으로 지워요. 분석 결과 글자와 측정값만 남아요. 「허용하기」를 누르면 목소리 녹음 수집에 동의하는 것으로 기록해요.
          </p>
          {err && <p role="alert" className="text-sm font-bold text-coral-ink">{err}</p>}
        </div>
        <div className="flex flex-col gap-2 px-6 pb-8 pt-4 lg:max-w-[520px]">
          <Button onClick={allow} disabled={busy}>
            마이크 허용하기
          </Button>
          <Button variant="ghost" onClick={() => router.push('/home')}>
            나중에 할게요
          </Button>
        </div>
      </AppShell>
    );

  return <MicCheck />;
}

function Stepper({ at }: { at: number }) {
  return (
    <ol className="hidden gap-2 px-6 pt-4 lg:flex" aria-label="시작 준비 단계">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === at ? 'step' : undefined} className={cx('flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold', i === at ? 'bg-brand text-white' : i < at ? 'bg-lime text-lime-ink' : 'bg-white text-faint')}>
          <span>{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

/** 디자인: MicDenied (앱) · WebMicError (웹: 브라우저 안내 + 휴대폰 앱 QR) */
function MicDenied({ unsupported, onRetry }: { unsupported: boolean; onRetry: () => void }) {
  return (
    <AppShell tabs={false}>
      <div className="lg:hidden">
        <BackHeader href="/login" />
      </div>
      <div className="flex flex-1 flex-col gap-6 px-6 pb-8 lg:grid lg:grid-cols-[1.3fr_1fr] lg:items-start lg:pt-10">
        <div className="flex flex-col justify-center gap-4">
          <Mascot size={88} mood="calm" />
          <h1 className="font-jua text-[28px] leading-snug">{unsupported ? '이 브라우저는 녹음을 지원하지 않아요' : '마이크가 막혀 있어요'}</h1>
          <span className="hidden text-[15px] text-sub lg:block">브라우저에서 마이크를 허용해 주세요</span>
          <ol className="flex flex-col gap-2.5 text-[15px] leading-relaxed">
            {['주소창 왼쪽 자물쇠를 눌러요', '마이크를 ‘허용’으로 바꿔요', '아래 버튼을 눌러 다시 확인해요'].map((t, i) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-dark">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <Button onClick={onRetry}>다시 확인하기</Button>
          <Button variant="ghost" href="/soundmap">
            녹음 없이 둘러보기
          </Button>
        </div>
        <aside className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2">
            <b>이 브라우저에서 녹음이 안 되나요?</b>
            <span className="text-sm leading-relaxed text-sub">최신 크롬, 엣지, 사파리, 웨일에서 쓸 수 있어요. 앱 안에서 링크를 열었다면 기본 브라우저로 다시 열어 주세요.</span>
          </Card>
          <div className="flex flex-col gap-3 rounded-[28px] bg-brand-soft p-6">
            <span className="font-jua text-[20px] text-brand-deep">휴대폰 앱으로 이어서 하기</span>
            <span className="text-[15px] leading-relaxed text-brand-deep">같은 계정으로 로그인하면 기록이 그대로 이어져요. 휴대폰 카메라로 찍고 「홈 화면에 추가」하면 앱처럼 쓸 수 있어요.</span>
            <Qr label="휴대폰으로 말랑말랑 열기 QR 코드" size={132} />
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function MicCheck() {
  const router = useRouter();
  const meter = useRecorder(60_000);
  const [noise, setNoise] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [vibe, setVibe] = useState<boolean | null>(null);
  const [tut, setTut] = useState<{ wav: Blob; durationMs: number } | null>(null);
  const [tutBusy, setTutBusy] = useState(false);
  const flow = useAttemptFlow({ context: 'MIC_CHECK', targetText: '아' }, (a) => setSaved(a.status === 'DONE'));

  useEffect(() => {
    localKv.get<{ wav: Blob; durationMs: number }>('tutorial-baseline').then((v) => v && setTut(v)).catch(() => undefined);
  }, []);

  // 1 · 주변 소리: 2초 동안 크기를 잰다 (기기 계산)
  useEffect(() => {
    let max = 0;
    let stopped = false;
    void meter.start();
    const iv = setInterval(() => (max = Math.max(max, meter.levelRef.current)), 100);
    const t = setTimeout(async () => {
      clearInterval(iv);
      if (!stopped) await meter.stop();
      setNoise(max);
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(iv);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const quiet = noise !== null && noise < 0.45;
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  /** 튜토리얼에서 녹음한 ‘아——’를 기준 목소리로 */
  const useTutorial = async () => {
    if (!tut) return;
    setTutBusy(true);
    try {
      const a = await attemptsApi.create(tut.wav, { context: 'MIC_CHECK', durationMs: tut.durationMs });
      const done = await attemptsApi.waitFor(a.id, () => undefined);
      setSaved(done.status === 'DONE');
      await localKv.del('tutorial-baseline');
      setTut(null);
    } finally {
      setTutBusy(false);
    }
  };

  const finish = async () => {
    await meApi.updateSettings({ haptics: vibe ?? false });
    router.push('/placement');
  };

  return (
    <AppShell tabs={false}>
      <div className="lg:hidden">
        <BackHeader title="시작 준비 · 진단 전에" />
      </div>
      <Stepper at={0} />
      <div className="flex flex-col gap-1.5 px-6 pt-1 lg:pt-6">
        <h1 className="font-jua text-[26px] leading-tight lg:text-[32px]">
          <span className="lg:hidden">진단 전에 30초만 준비할게요</span>
          <span className="hidden lg:inline">시작 전에 세 가지만 맞춰요</span>
        </h1>
        <p className="text-sm text-sub">내 평소 목소리를 기준으로 삼아서, 다음부터 나아진 걸 비교해요.</p>
      </div>
      <div className="flex flex-col gap-3 px-5 pt-4 lg:grid lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3">
          <Card className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-bold">
              <span>1 · 주변 소리</span>
              <span className={noise === null ? 'text-muted' : quiet ? 'text-pass-text' : 'text-coral-ink'}>{noise === null ? '재는 중' : quiet ? '조용해요 · 녹음하기 좋아요' : '조금 시끄러워요'}</span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-line">
              <div className={cx('h-full rounded-full', quiet ? 'bg-pass' : 'bg-coral')} style={{ width: `${(noise ?? meter.level) * 100}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted">
              <span>조용함</span>
              <span>시끄러움</span>
            </div>
          </Card>
          <Card className="flex flex-col gap-3">
            <div className="flex justify-between text-sm font-bold">
              <span>2 · 평소 목소리로 “아——” 3초</span>
              {saved && <span className="text-pass-text">기준 목소리 저장됨</span>}
            </div>
            {tut && !saved && (
              <div className="flex items-center justify-between gap-2 rounded-2xl bg-brand-soft p-3 text-sm text-brand-deep">
                <span>튜토리얼에서 녹음한 “아——” ({(tut.durationMs / 1000).toFixed(1)}초)를 기준으로 쓸까요?</span>
                <button type="button" onClick={useTutorial} disabled={tutBusy} className="min-h-[40px] shrink-0 rounded-xl bg-brand px-3 font-bold text-white">
                  {tutBusy ? '저장 중' : '쓰기'}
                </button>
              </div>
            )}
            {flow.phase === 'issue' && flow.issue ? (
              <IssueBox issue={flow.issue} onRetry={flow.reset} />
            ) : (
              <>
                <LiveBars history={flow.rec.history} active={flow.rec.state === 'recording'} />
                <div className="flex items-center justify-between">
                  <span className="text-xs leading-relaxed text-sub">
                    이 목소리가 앞으로 비교하는 ‘내 기준’이 돼요.
                    <br />
                    설정에서 다시 잡을 수 있어요.
                  </span>
                  <MicButton recording={flow.rec.state === 'recording'} onClick={flow.toggle} disabled={noise === null || flow.phase === 'uploading' || flow.phase === 'analyzing'} label={flow.phase === 'analyzing' || flow.phase === 'uploading' ? '저장 중' : saved ? '다시 녹음' : undefined} />
                </div>
              </>
            )}
            {flow.error && <p role="alert" className="text-sm font-bold text-coral-ink">{flow.error}</p>}
          </Card>
          <Card className="flex flex-col gap-2.5">
            <span className="text-sm font-bold">3 · 휴대폰이 진동했나요?</span>
            <span className="text-xs text-sub">소리 모양을 진동으로도 알려드려요{!canVibrate && ' · 이 기기는 진동을 지원하지 않아요 (안드로이드 브라우저에서만)'}</span>
            <div className="flex gap-2">
              {canVibrate && (
                <button type="button" className="min-h-[44px] rounded-xl bg-bg px-3 text-sm font-bold text-brand-dark" onClick={() => navigator.vibrate?.([120, 60, 120])}>
                  진동 울리기
                </button>
              )}
              {[true, false].map((v) => (
                <button key={String(v)} type="button" aria-pressed={vibe === v} onClick={() => setVibe(v)} className={cx('min-h-[44px] flex-1 rounded-xl text-sm font-bold', vibe === v ? 'bg-brand text-white' : 'bg-bg text-sub')}>
                  {v ? '네, 느껴져요' : '아니요'}
                </button>
              ))}
            </div>
          </Card>
        </div>
        <aside className="hidden flex-col gap-3 lg:flex" aria-label="다음 단계">
          {[
            ['2 · 첫 진단', '글자 23 · 단어 8 · 문장 3 · 약 4분. 세 단계 모두 또렷한 소리는 미리 통과돼요.'],
            ['3 · 내 연습 순서', '모음 → 이중모음 → ㅅ·ㅆ → 가·카·까 → 억양·길이. 자음·모음을 바로잡을 때 알아듣는 정도가 가장 크게 올랐다는 연구를 따랐어요.'],
            ['4 · 하루 목표', '3개 · 5개(추천) · 10개 · 브라우저 알림으로 알려드려요.'],
          ].map(([t, d]) => (
            <Card key={t} className="flex flex-col gap-1 opacity-80">
              <b className="text-sm">{t}</b>
              <span className="text-sm leading-relaxed text-sub">{d}</span>
            </Card>
          ))}
        </aside>
      </div>
      <div className="mt-auto flex flex-col gap-1 px-5 pb-8 pt-4 lg:max-w-[420px]">
        {saved && <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">준비 끝! 이제 진단해 볼까요?</span>}
        <Button onClick={finish} disabled={!saved}>
          진단 시작하기
        </Button>
      </div>
    </AppShell>
  );
}
