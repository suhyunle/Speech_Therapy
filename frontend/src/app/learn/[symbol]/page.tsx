'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AppShell, BackHeader, Button, Card, Chip, ErrorState, Loading } from '@/components/ui';
import { HissKHzMeter } from '@/features/record/HissKHzMeter';
import { Mouth, SHAPE_OF, VOWEL_LIST, useMouthClock } from '@/features/vowels/Mouth';
import { useRecorder } from '@/hooks/useRecorder';
import { errorText } from '@/services/api';
import { contentApi, planApi } from '@/services/endpoints';

/** 디자인에 있는 단면도·입모양만 그 소리에 보여준다 (다른 소리에 비슷한 그림을 돌려쓰지 않음) */
const DIAGRAM: Record<string, { src: string; alt: string }> = {
  ㅅ: { src: '/diagrams/alveolar.svg', alt: '얼굴 옆 단면도: 혀끝이 윗잇몸 바로 아래에서 좁은 틈을 만들고 바람이 앞니 사이로 빠져나가요' },
  ㅆ: { src: '/diagrams/alveolar.svg', alt: '얼굴 옆 단면도: ㅅ과 같은 자리, 혀끝 틈으로 바람이 세게 나가요' },
  ㅂ: { src: '/diagrams/bilabial.svg', alt: '입술소리 단면도: 두 입술을 붙여 공기를 모았다가 톡 열어요' },
  ㅃ: { src: '/diagrams/bilabial.svg', alt: '입술소리 단면도: 두 입술을 꽉 붙였다가 단단하게 열어요' },
  ㅍ: { src: '/diagrams/bilabial.svg', alt: '입술소리 단면도: 두 입술을 붙였다가 바람을 세게 터뜨려요' },
  ㅓ: { src: '/diagrams/vowel-a.svg', alt: 'ㅓ 입모양: 쉬는 입에서 세로로 중간만큼 벌어져요' },
  ㅗ: { src: '/diagrams/vowel-b.svg', alt: 'ㅗ 입모양: 입술을 동그랗게 앞으로' },
};

function Lesson() {
  const { symbol: raw } = useParams<{ symbol: string }>();
  const symbol = decodeURIComponent(raw);
  const nextParam = useSearchParams().get('next');
  const sound = useQuery({ queryKey: ['sound', symbol], queryFn: () => contentApi.sound(symbol) });
  const plan = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  if (sound.isLoading) return <Loading />;
  if (sound.error || !sound.data) return <ErrorState message={errorText(sound.error)} onRetry={() => sound.refetch()} />;
  const s = sound.data;
  const g = s.guide;
  const isCurrent = plan.data?.current?.symbol === symbol;
  const nextId = nextParam ?? (isCurrent ? plan.data?.items.find((i) => !i.done)?.id : undefined) ?? s.items?.find((i) => i.kind === 'WORD')?.id;
  const d = DIAGRAM[symbol];
  const isVowel = s.kind !== 'CONSONANT';
  const baselineFirst = isCurrent && plan.data?.baselineNeeded;
  const unit = plan.data?.groups.find((x) => x.key === s.groupKey);
  const unitIdx = (plan.data?.groups.findIndex((x) => x.key === s.groupKey) ?? -1) + 1;
  const today = plan.data && isCurrent ? `오늘 ${plan.data.completed}/${plan.data.goal}` : undefined;

  return (
    <AppShell tabs={false} wide>
      <BackHeader title={today ?? '소리 배우기'} />
      {unit && <span className="hidden px-6 text-sm font-bold text-brand-dark lg:block">{unitIdx}단원 · {unit.label}</span>}
      <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-6">
      <div className="flex flex-col">
      <div className="flex items-center gap-4 px-6 pt-2">
        <span className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-brand font-jua text-[48px] text-white shadow-node">{symbol}</span>
        <div className="flex flex-col gap-1">
          <span className="font-jua text-[24px]">{s.kind === 'CONSONANT' ? `${g.place} · ${g.manner}` : s.kind === 'VOWEL' ? '모음' : '이중모음'}</span>
          <div className="flex flex-wrap gap-1.5">
            {s.kind === 'CONSONANT' ? (
              <>
                <Chip>{g.place}</Chip>
                <Chip tone="coral">{g.manner}</Chip>
                <Chip tone="muted">{g.voicing}</Chip>
              </>
            ) : (
              <Chip>{g.cue}</Chip>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-5 pt-4">
        {isVowel && <VowelMouth symbol={symbol} compare={g.compare?.symbol} />}
        {d && !isVowel && (
          <Card className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.src} alt={d.alt} className="h-auto max-h-[220px] w-full max-w-[280px]" />
          </Card>
        )}
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <span className="font-jua text-[44px] text-brand">{g.cue}—</span>
            <span className="text-sm text-sub">이렇게 소리 내요</span>
          </div>
          <ol className="flex flex-col gap-2.5">
            {g.steps.map((step, i) => (
              <li key={step} className="flex items-start gap-2.5 text-[15px] leading-relaxed">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </Card>
        {g.compare && (
          <Card className="flex items-center gap-3 bg-coral-soft shadow-[0_5px_0_#FFE1D6]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white font-jua text-[26px] text-coral-ink">{g.compare.symbol}</span>
            <span className="text-sm leading-relaxed text-ink">{g.compare.text}</span>
          </Card>
        )}
        {symbol === 'ㅅ' && <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">ㅅ은 원래 오래 걸리는 소리예요. 여기까지 온 것도 대단해요!</span>}
      </div>
      </div>
      <aside className="flex flex-col gap-3 px-5 pt-4 lg:px-0">
        {(symbol === 'ㅅ' || symbol === 'ㅆ') && <LiveHiss />}
        <Feel manner={s.manner} />
        {isVowel && (
          <a href="/soundmap/vowels" className="rounded-2xl bg-white p-4 text-sm font-bold text-brand-dark shadow-chip">
            모음 10개 입모양 보기 ›
          </a>
        )}
      </aside>
      </div>
      <div className="mt-auto flex flex-col gap-2 px-5 pb-8 pt-5 lg:max-w-[420px]">
        {baselineFirst ? (
          <>
            <Button href={`/baseline/${encodeURIComponent(symbol)}`}>시작 전 지금 소리 남기기</Button>
            <span className="text-center text-xs text-muted">배우기 전에 3단어를 녹음해 두면, 일주일 뒤 달라진 것만 비교해 드려요</span>
          </>
        ) : nextId ? (
          <Button href={`/practice/${nextId}?sound=${encodeURIComponent(symbol)}`}>{s.items?.find((i) => i.id === nextId)?.text ? `“${s.items.find((i) => i.id === nextId)!.text}” 말해보기` : '직접 말해보기'}</Button>
        ) : (
          <Button disabled>연습할 단어를 준비 중이에요</Button>
        )}
      </div>
    </AppShell>
  );
}

export default function LearnPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Lesson />
    </Suspense>
  );
}

/** 디자인: LearnVowel · 거울처럼 따라 해요 (쉬는 입 → 모음) + 헷갈리는 모음 비교 */
function VowelMouth({ symbol, compare }: { symbol: string; compare?: string }) {
  const clock = useMouthClock();
  const shape = SHAPE_OF[symbol];
  if (!shape) return null;
  const v = VOWEL_LIST.find((x) => x.k === symbol);
  const c = compare ? SHAPE_OF[compare] : undefined;
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-bold">
        <span>거울처럼 따라 해요 · 쉬는 입 → {symbol}</span>
        <button type="button" onClick={clock.toggle} className="min-h-[36px] text-brand-dark">
          {clock.on ? '멈추기' : '움직이기'}
        </button>
      </div>
      <div className={c ? 'grid grid-cols-2 gap-2' : 'flex justify-center'}>
        <div className="flex flex-col items-center">
          <Mouth shape={shape} glide={!!(v && 'glide' in v)} t={clock.t} on={clock.on} label={`${symbol} 입모양`} id={`lv-${symbol}`} />
          <b className="font-jua text-xl">{symbol}</b>
        </div>
        {c && compare && (
          <div className="flex flex-col items-center opacity-80">
            <Mouth shape={c} t={clock.t} on={clock.on} label={`${compare} 입모양`} id={`lv-${compare}`} />
            <b className="font-jua text-xl text-coral-ink">헷갈리는 {compare}</b>
          </div>
        )}
      </div>
    </Card>
  );
}

/** 디자인: WebLearn · ㅅ 쉬익 미터 (듣기만, 저장 안 함) */
function LiveHiss() {
  const rec = useRecorder(30_000);
  const on = rec.state === 'recording';
  return (
    <Card className="flex flex-col gap-3 pt-7">
      <HissKHzMeter khz={rec.hissKHz} strength={rec.hiss} listening={on} />
      <Button variant={on ? 'outline' : 'primary'} onClick={() => (on ? void rec.stop() : void rec.start())}>
        {on ? '듣기 멈추기' : '“스—” 하면서 미터 보기'}
      </Button>
      {rec.state === 'denied' && <span className="text-xs text-coral-ink">마이크 권한이 꺼져 있어요. 브라우저 주소창의 자물쇠에서 마이크를 허용해 주세요.</span>}
      <span className="text-[11px] text-muted">미터를 보는 동안의 소리는 저장하지 않아요.</span>
    </Card>
  );
}

const FEEL: [RegExp, [string, string, number[]][]][] = [
  [/바람 소리/, [['스—', '가늘고 길게 쉬익— 끊기지 않고 새어 나와요', [900]], ['츠!', '혀로 막았다가 팍! 짧게 터져요. 이건 ㅊ이에요', [80, 20, 300]]]],
  [/세게 터지는|세게 비비는/, [['팍!', '막았다가 팍! 바람 뭉치가 세게 나와요. 손바닥에 확 느껴져요', [80, 20, 300]]]],
  [/단단하게/, [['꽉', '목과 입에 힘을 꽉 주고 짧고 단단하게', [120]]]],
  [/막았다 터지는/, [['톡', '막았다가 살짝 톡. 바람은 거의 없어요', [40]]]],
  [/비비며/, [['츠', '막았다가 톡 터지며 바람이 조금 새요', [50, 20, 160]]]],
  [/코로 울리는/, [['음—', '콧등에 손가락을 대면 웅웅 떨려요', [60, 40, 60, 40, 60, 40, 60]]]],
  [/튕기는/, [['ㄹ', '혀끝이 윗잇몸을 가볍게 한 번 톡', [15]]]],
  [/숨을 내쉬는/, [['하—', '목에서 따뜻한 숨이 나와요', [600]]]],
];

/** 손바닥에 닿는 바람 · 진동으로 느끼기 */
function Feel({ manner }: { manner: string }) {
  const f = FEEL.find(([re]) => re.test(manner))?.[1];
  if (!f) return null;
  const vib = (p: number[]) => typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate(p);
  return (
    <Card className="flex flex-col gap-2">
      <b className="text-sm">손바닥에 닿는 바람 · 진동으로 느끼기</b>
      {f.map((x) => (
        <button key={x[0]} type="button" onClick={() => vib(x[2])} className="flex items-center gap-3 rounded-2xl bg-bg p-3 text-left">
          <b className="font-jua text-[24px] text-brand-dark">{x[0]}</b>
          <span className="text-sm text-sub">{x[1]}</span>
        </button>
      ))}
      <a href="/soundmap/textures" className="text-xs font-bold text-brand-dark">소리 모양 사전 ›</a>
    </Card>
  );
}
