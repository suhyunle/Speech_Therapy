'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, Card, Logo, cx } from '@/components/ui';
import { LiveBars, MicButton } from '@/features/record/RecordPanel';
import { useRecorder } from '@/hooks/useRecorder';
import { localKv } from '@/utils/offline';

const STEPS = ['말했는데 “네?”', '들린 그대로 보기', '어디가, 왜 다른지', '직접 “아——”', '변화가 숫자로', '우리의 약속'];

/** 디자인: TutPain · TutHeard · TutWhy · TutTry · TutGrow · TutPromise (+ 웹: WebTutorial 1분 둘러보기) */
export default function TutorialPage() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const next = () => (i < STEPS.length - 1 ? setI(i + 1) : router.push('/login'));
  const body = [<Pain key={0} />, <HeardStep key={1} />, <Why key={2} />, <Try key={3} />, <Grow key={4} />, <Promise key={5} />][i];
  const cta = ['어떻게요?', '다음', '나도 해볼래요', '다음', '다음', '시작하기'][i];
  return (
    <main className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-5 pt-6 lg:px-8">
        <span className="hidden lg:block">
          <Logo />
        </span>
        <span className="text-[13px] font-bold text-brand-dark lg:hidden">
          튜토리얼 {i + 1} · {STEPS[i]}
        </span>
        <span className="hidden text-sm font-bold text-sub lg:block">처음 오셨나요? 1분 둘러보기</span>
        <Link href="/login" className="flex min-h-[44px] items-center text-sm font-bold text-muted">
          건너뛰기
        </Link>
      </header>
      <div className="mx-auto flex max-w-[1080px] gap-8 px-5 lg:px-8 lg:pt-8">
        <ol className="hidden w-64 shrink-0 flex-col gap-1.5 lg:flex" aria-label="둘러보기 단계">
          {STEPS.map((s, k) => (
            <li key={s}>
              <button type="button" onClick={() => setI(k)} aria-current={k === i ? 'step' : undefined} className={cx('flex min-h-[48px] w-full items-center gap-3 rounded-2xl px-3 text-left text-[15px]', k === i ? 'bg-white font-bold shadow-chip' : 'text-muted')}>
                <span className={cx('flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold', k < i ? 'bg-pass text-white' : k === i ? 'bg-brand text-white' : 'bg-line text-muted')}>{k + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>
        <div className="mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-[480px] flex-col pb-8 lg:mx-0 lg:min-h-0 lg:max-w-[640px]">
          <div className="flex gap-1.5 pb-4 pt-3 lg:hidden" aria-hidden>
            {STEPS.map((_, k) => (
              <span key={k} className={cx('h-1.5 flex-1 rounded-full', k <= i ? 'bg-brand' : 'bg-line')} />
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-4">{body}</div>
          <div className="flex gap-2 pt-6">
            {i > 0 && (
              <Button variant="outline" className="hidden w-32 lg:flex" onClick={() => setI(i - 1)}>
                이전
              </Button>
            )}
            <Button onClick={next}>{cta}</Button>
          </div>
        </div>
      </div>
    </main>
  );
}

const H = ({ children }: { children: ReactNode }) => <h1 className="font-jua text-[30px] leading-tight lg:text-[36px]">{children}</h1>;

function Pain() {
  return (
    <>
      <H>
        말했는데 “네?” 하고
        <br />
        되물은 적 있나요?
      </H>
      <Card className="flex flex-col gap-2.5">
        <span className="self-end rounded-[18px_18px_4px_18px] bg-brand px-4 py-2.5 text-white">사과 두 개 주세요</span>
        <span className="self-start rounded-[18px_18px_18px_4px] bg-bg px-4 py-2.5">
          네? <b className="text-coral-ink">다과</b> 요?
        </span>
        <span className="self-end rounded-[18px_18px_4px_18px] bg-brand px-4 py-2.5 text-white">아니요, 사… 과요</span>
      </Card>
      <p className="text-[15px] leading-relaxed text-sub">내 귀로 내 발음을 확인하기 어려우면, 어디가 다른지 알 방법이 없어요. 연습을 해도 맞게 하고 있는지 모르죠.</p>
      <div className="flex flex-wrap gap-2">
        {['ㅅ이 ㄷ처럼 나요', '끝소리가 작아져요', 'ㅓ와 ㅗ가 비슷해요'].map((t) => (
          <span key={t} className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-sub shadow-chip">
            {t}
          </span>
        ))}
      </div>
      <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">괜찮아요. 여기선 귀 대신 눈으로 확인해요</span>
    </>
  );
}

function HeardStep() {
  const [shown, setShown] = useState(false);
  return (
    <>
      <H>
        말랑말랑은 내 말을
        <br />
        들린 그대로 보여줘요
      </H>
      <p className="text-[15px] leading-relaxed text-sub">보통 음성인식은 알아서 고쳐서 보여줘요. 그러면 내가 어떻게 말했는지 알 수 없어요.</p>
      <span className="text-xs font-bold text-muted">예시 · “사과”라고 말했을 때</span>
      <div className="grid gap-2 md:grid-cols-2">
        <Card className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">보통 음성인식</span>
          <span className="font-jua text-[36px]">사과</span>
          <span className="text-xs text-coral-ink">알아서 고쳐줌 → 틀린 줄 모름</span>
        </Card>
        <button type="button" onClick={() => setShown(true)} aria-pressed={shown} className="flex flex-col gap-1 rounded-[22px] bg-ink p-4 text-left text-white">
          <span className="text-xs font-bold text-[#C8C5DD]">말랑말랑 · 들린 대로</span>
          <span className="font-jua text-[36px]">
            {shown ? (
              <>
                <span className="rounded-md bg-coral px-1 text-ink">다</span>과
              </>
            ) : (
              '? ?'
            )}
          </span>
          <span className="text-xs text-[#C8C5DD]">{shown ? '고치지 않음 → 바로 보임' : '눌러서 들린 대로 보기'}</span>
        </button>
      </div>
      {shown && <p className="text-[15px] leading-relaxed">첫 소리 ㅅ이 ㄷ처럼 들렸어요. 이렇게 보이면, 고칠 곳이 딱 하나로 좁혀져요.</p>}
      <span className="self-start rounded-full bg-brand-soft px-3 py-1.5 text-[13px] font-bold text-brand-dark">점수 대신 무엇이 어떻게 들렸는지만 보여줘요</span>
    </>
  );
}

function Why() {
  return (
    <>
      <H>
        어디가, 왜 다른지
        <br />
        그림으로 알려줘요
      </H>
      <Card className="flex flex-col gap-2">
        <span className="text-sm font-bold">① 한 소리씩 비교</span>
        <div className="grid grid-cols-4 gap-2">
          {[
            ['ㅅ', 'ㄷ', false],
            ['ㅏ', 'ㅏ', true],
            ['ㄱ', 'ㄱ', true],
            ['ㅘ', 'ㅘ', true],
          ].map(([a, b, ok], k) => (
            <div key={k} className="flex flex-col gap-1">
              <span className="flex h-9 items-center justify-center rounded-xl bg-bg font-jua text-xl">{a as string}</span>
              <span className={cx('flex h-9 items-center justify-center rounded-xl font-jua text-xl', ok ? 'bg-pass text-white' : 'bg-coral')}>{b as string}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="flex flex-col gap-2">
        <span className="text-sm font-bold">② 바람을 눈으로 · ㅅ은 이렇게 길게 새어 나와야 해요</span>
        <div className="flex h-10 items-center gap-[3px]" aria-hidden>
          {Array.from({ length: 30 }, (_, k) => (
            <span key={k} className={cx('w-full rounded-full', k < 18 ? 'bg-coral' : 'bg-brand')} style={{ height: `${k < 18 ? 40 + (k % 3) * 8 : 70 - (k - 18) * 3}%` }} />
          ))}
        </div>
        <span className="font-jua text-[22px] text-coral-ink">스—</span>
      </Card>
      <Card className="flex flex-col gap-2">
        <span className="text-sm font-bold">③ 쉬익 미터 · 바람 높이가 초록 칸에 들어오면 OK</span>
        <div className="relative h-3 rounded-full bg-line">
          <div className="absolute inset-y-0 left-[60%] right-[15%] rounded-full bg-pass-range" />
          <span className="absolute -top-1.5 left-[68%] h-6 w-6 rounded-full border-[3px] border-white bg-pass" />
        </div>
        <div className="flex justify-between text-[11px] text-muted">
          {[0, 2, 4, 6, 8, 10].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </Card>
      <p className="text-[15px] leading-relaxed text-sub">그리고 방법 하나: “혀끝을 붙이지 말고 틈을 남겨요.” 고칠 것은 한 번에 하나만 알려줘요.</p>
    </>
  );
}

/** 튜토리얼 4: 직접 “아——” 3초. 결과는 기기에서 바로 계산하고, 로그인 뒤 ‘내 기준 목소리’로 쓸 수 있게 이 기기에 보관한다. */
function Try() {
  const rec = useRecorder(6000);
  const [res, setRes] = useState<{ sec: number; even: boolean } | null>(null);
  const toggle = async () => {
    if (rec.state !== 'recording') return void (setRes(null), rec.start());
    const r = await rec.stop();
    if (!r) return;
    const hop = 160;
    const db: number[] = [];
    for (let i = 0; i + 400 <= r.samples.length; i += hop) {
      let s = 0;
      for (let j = i; j < i + 400; j++) s += r.samples[j] ** 2;
      db.push(10 * Math.log10(s / 400 + 1e-12));
    }
    const floor = [...db].sort((a, b) => a - b)[Math.floor(db.length * 0.1)] ?? -90;
    let run = 0;
    let best = 0;
    const voiced: number[] = [];
    for (const d of db) {
      if (d > Math.max(floor + 10, -45)) {
        run++;
        voiced.push(d);
      } else run = 0;
      best = Math.max(best, run);
    }
    const mean = voiced.reduce((a, b) => a + b, 0) / Math.max(1, voiced.length);
    const sd = Math.sqrt(voiced.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, voiced.length));
    setRes({ sec: Math.round(((best * hop) / 16000) * 10) / 10, even: sd < 4 });
    if (!r.precheck) await localKv.set('tutorial-baseline', { wav: r.wav, durationMs: r.durationMs, at: Date.now() }).catch(() => undefined);
  };
  return (
    <>
      <H>
        직접 해봐요
        <br />
        3초만 “아——”
      </H>
      <p className="text-[15px] text-sub">편한 높이로 길게. 맞고 틀린 건 없어요.</p>
      <Card className="flex flex-col gap-3">
        <LiveBars history={rec.history} active={rec.state === 'recording'} />
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-sub">{rec.state === 'recording' ? `듣고 있어요 · ${(rec.elapsed / 1000).toFixed(1)}초` : res ? '첫 녹음 성공!' : rec.state === 'denied' ? '마이크가 꺼져 있어요' : '버튼을 누르고 “아——”'}</span>
          <MicButton recording={rec.state === 'recording'} onClick={toggle} />
        </div>
      </Card>
      {res && (
        <Card className="flex flex-col gap-2 bg-pass-soft shadow-[0_5px_0_#C9F0DF]">
          <b className="font-jua text-[22px] text-pass-ink">첫 녹음 성공!</b>
          <span className="text-[15px]">✓ 목소리가 {res.sec}초 동안 끊기지 않았어요</span>
          <span className="text-[15px]">{res.even ? '✓ 크기가 처음부터 끝까지 고르게 나왔어요' : '· 크기가 조금 오르내렸어요 · 괜찮아요'}</span>
          <span className="text-sm text-sub">이 소리가 ‘내 기준 목소리’가 돼요. 앞으로는 남이 아니라 나와 비교해요.</span>
        </Card>
      )}
      <span className="text-xs leading-relaxed text-muted">마이크 버튼을 누르고 말한 뒤, 다시 누르면 끝나요. 소리가 안 나와도 화면에서 바로 알려줘요.</span>
    </>
  );
}

function Grow() {
  return (
    <>
      <H>
        작은 변화도
        <br />
        숫자로 보여요
      </H>
      <p className="text-[15px] text-sub">매일 조금씩 하면, 달라진 게 눈에 보여요.</p>
      <Card className="flex flex-col gap-3">
        <span className="text-xs font-bold text-muted">ㅅ · 처음과 3주 뒤 화면 예시</span>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="rounded-xl bg-bg p-3">
            처음
            <br />
            바람 길이 <b>0.05초</b>
            <br />
            들린 대로 <b className="text-coral-ink">다과</b>
          </span>
          <span className="rounded-xl bg-pass-soft p-3 text-pass-ink">
            3주 뒤
            <br />
            바람 길이 <b>0.18초</b>
            <br />
            들린 대로 <b>사과</b>
          </span>
        </div>
      </Card>
      <div className="grid gap-2 md:grid-cols-2">
        <Card>
          <b className="text-sm">사람 귀로도 확인</b>
          <p className="text-sm text-sub">가족·친구에게 링크를 보내 들린 대로 받아써 달래요</p>
        </Card>
        <Card>
          <b className="text-sm">하루 9분이면 충분</b>
          <p className="text-sm text-sub">단어 5개 · 끝이 보이는 오늘의 학습</p>
        </Card>
      </div>
      <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">잘한 건 꼭 먼저 말해줄게요!</span>
    </>
  );
}

function Promise() {
  const items = [
    ['0', '점수를 매기지 않아요', '들린 대로와 잰 값만, 사실 그대로'],
    ['귀', '사람 귀가 기준이에요', '앱이 헷갈리면 “확실하지 않아요”라고 말해요'],
    ['나', '남이 아니라 나와 비교해요', '처음 내 목소리에서 얼마나 달라졌는지'],
    ['내', '내 녹음은 내 것', '언제든 지울 수 있고, 허락 없이 쓰지 않아요'],
    ['무', '무료예요', '카메라도 쓰지 않아요 · 마이크만'],
  ];
  return (
    <>
      <H>말랑말랑의 약속</H>
      <ul className="flex flex-col gap-2">
        {items.map(([k, t, d]) => (
          <li key={t} className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 shadow-chip">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-soft font-jua text-[20px] text-brand-dark">{k}</span>
            <span className="flex flex-col">
              <b className="text-[15px]">{t}</b>
              <span className="text-[13px] text-sub">{d}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-center font-jua text-[20px] text-brand-dark">이제 내 소리를 처음으로 볼 차례예요</p>
    </>
  );
}
