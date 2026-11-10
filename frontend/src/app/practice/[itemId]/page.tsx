'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AppShell, BackHeader, Button, Card, Chip, ErrorState, Loading, Sheet, cx } from '@/components/ui';
import { Heard } from '@/features/record/Heard';
import { Analyzing, HissMeter, IssueBox, LiveBars, MicButton, OfflineBox, useAttemptFlow } from '@/features/record/RecordPanel';
import { Mouth, SHAPE_OF, useMouthClock } from '@/features/vowels/Mouth';
import { VowelMap } from '@/features/vowels/VowelMap';
import { CONSONANTS } from '@/utils/hangul';
import { VOWEL_TARGETS } from '@/utils/lpc';
import { errorText } from '@/services/api';
import { contentApi, planApi } from '@/services/endpoints';
import type { Attempt } from '@/types/api';

const CHEER = ['좋아요, 끝까지 이어서!', '천천히, 또박또박!', '끊지 말고 이어서 말해요'];

function Practice() {
  const { itemId } = useParams<{ itemId: string }>();
  const sp = useSearchParams();
  const sound = sp.get('sound') ?? undefined;
  // 내 글로 연습에서 바뀐 단어 연습: /practice/custom?text=...
  const custom = itemId === 'custom' ? (sp.get('text') ?? '').slice(0, 60) : null;
  const from = sp.get('from');
  const isVowel = !!sound && !CONSONANTS.includes(sound) && !!SHAPE_OF[sound];
  const clock = useMouthClock(isVowel);
  const router = useRouter();
  const qc = useQueryClient();
  const item = useQuery({
    queryKey: ['item', itemId, custom],
    queryFn: () => (custom !== null ? Promise.resolve({ id: 'custom', kind: (custom.length > 6 ? 'SENTENCE' : 'WORD') as 'WORD' | 'SENTENCE', text: custom, pronunciation: custom, note: null, targetSounds: [] }) : contentApi.item(itemId)),
  });
  const plan = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  const [done, setDone] = useState<Attempt | null>(null);
  const [exit, setExit] = useState(false);
  const flow = useAttemptFlow(
    { context: 'PRACTICE', itemId: custom !== null ? undefined : itemId, text: custom ?? undefined, targetText: custom ?? item.data?.text, soundSymbol: sound },
    (a) => {
      if (a.status === 'DONE') {
        setDone(a);
        void qc.invalidateQueries({ queryKey: ['plan'] });
      }
    },
    { formants: isVowel },
  );
  if (custom === '') return <ErrorState message="연습할 단어가 없어요" />;
  if (item.isLoading) return <Loading />;
  if (item.error || !item.data) return <ErrorState message={errorText(item.error)} onRetry={() => item.refetch()} />;
  const it = item.data;
  const hissy = /[사-싷싸-앃]/.test(it.pronunciation) || sound === 'ㅅ' || sound === 'ㅆ';
  const busy = flow.phase === 'uploading' || flow.phase === 'analyzing';
  const p = plan.data;
  const progress = p && custom === null ? Math.min(1, p.completed / p.goal) : undefined;
  const recording = flow.rec.state === 'recording';
  const vp = done?.result?.vowelPoint;

  return (
    <AppShell tabs={false} wide>
      <BackHeader
        progress={progress}
        right={
          <button type="button" onClick={() => setExit(true)} className="min-h-[44px] text-sm font-bold text-muted">
            {p && custom === null ? `오늘 ${p.completed}/${p.goal}` : '나가기'}
          </button>
        }
      />
      <div className="lg:grid lg:grid-cols-[1fr_1fr] lg:gap-6">
        <div className="flex flex-col">
          <div className="flex flex-col gap-1 px-6 pt-3">
            <span className="text-[13px] font-bold text-brand-dark">
              {custom !== null ? '내 글로 연습 · 바뀐 단어' : '따라 말하기'}
              {sound ? ` · ${sound}` : ''}
            </span>
            <h1 className="font-jua text-[24px]">{it.kind === 'SENTENCE' ? '오늘의 문장 · 끊지 말고 이어서' : '보고 그대로 말해요'}</h1>
          </div>
          <Card className="mx-5 mt-4 flex flex-col items-center gap-3 rounded-[30px] px-5 py-7 shadow-[0_6px_0_#E6E3F2]">
            <span className={cx('text-center font-jua leading-tight', it.kind === 'SENTENCE' ? 'text-[32px]' : 'text-[64px] tracking-[0.15em]')}>{it.text}</span>
            {it.pronunciation.replace(/\s/g, '') !== it.text.replace(/[\s.?!,]/g, '') && <Chip tone="muted">소리 나는 대로 [{it.pronunciation}]</Chip>}
            {it.note && <Chip>{it.note}</Chip>}
          </Card>
          {isVowel && sound && (
            <Card className="mx-5 mt-3 flex items-center gap-3">
              <div className="w-32 shrink-0">
                <Mouth shape={SHAPE_OF[sound]} t={clock.t} on={clock.on} label={`${sound} 입모양`} id={`pm-${sound}`} />
              </div>
              <span className="text-sm leading-relaxed text-sub">거울로 확인해요 · {sound} 입모양을 만든 채로 목소리를 길게 내요.</span>
            </Card>
          )}
        </div>
        <div className="flex flex-col">
          <Card className="mx-5 mt-3 flex flex-col gap-3 lg:mt-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold">{isVowel ? '내 모음 · 실시간' : '내 소리 · 눈으로 보기'}</span>
              <span className={cx('text-xs font-bold', recording ? 'text-coral-ink' : 'text-muted')}>{recording ? `녹음 중 ${(flow.rec.elapsed / 1000).toFixed(1)}초` : done ? '녹음했어요' : '아직 녹음 전'}</span>
            </div>
            {isVowel ? (
              <>
                <VowelMap set={p?.vowelSet ?? 'f'} targets={p?.vowelTargets ? { ...VOWEL_TARGETS[p.vowelSet ?? 'f'], ...p.vowelTargets } : undefined} target={sound} live={recording ? flow.rec.vowel : null} trail={recording ? flow.rec.trail : []} point={!recording && vp ? vp : null} />
                {vp && !recording && (
                  <span className="text-sm leading-relaxed text-sub">
                    {vp.nearest === sound ? `${sound} 칸 가까이 찍혔어요!` : `${vp.nearest} 쪽으로 조금 갔어요. ${sound === 'ㅓ' && vp.nearest === 'ㅗ' ? '입술 힘을 빼고 다시 해봐요.' : '입모양을 거울로 보고 다시 해봐요.'}`}
                  </span>
                )}
                <span className="text-[11px] text-muted">모음 지도의 점은 녹음에서 잰 소리 성분(포먼트)으로 찍어요. 점수 대신 위치만 보여드려요.{p?.vowelTargets ? ' 목표 칸은 내 목소리에 맞춘 위치예요.' : ''}</span>
              </>
            ) : (
              <LiveBars history={flow.rec.history} active={recording} />
            )}
            {hissy && <HissMeter value={flow.rec.hiss} />}
            {done && (
              <div className="flex flex-col gap-0.5 rounded-2xl bg-ink px-4 py-3 text-white">
                <span className="text-[11px] font-bold text-[#C8C5DD]">들린 대로 · 맞춤법 보정 없이</span>
                <Heard target={it.text} heard={done.heard} className="font-jua text-[26px]" />
              </div>
            )}
          </Card>
          <div className="flex flex-1 flex-col gap-3 px-5 pt-3">
            {busy && <Analyzing />}
            {flow.phase === 'offline' && <OfflineBox />}
            {flow.phase === 'issue' && flow.issue && <IssueBox issue={flow.issue} onRetry={flow.reset} />}
            {flow.error && <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-bold text-coral-ink">{flow.error}</p>}
          </div>
          <div className="flex flex-col items-center gap-3 px-5 pb-8 pt-3">
            {!busy && flow.phase !== 'issue' && (
              <>
                {recording && <span className="rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">{CHEER[Math.floor(flow.rec.elapsed / 2000) % CHEER.length]}</span>}
                <MicButton recording={recording} onClick={() => (setDone(null), flow.toggle())} label={done && !recording ? '다시 녹음' : undefined} />
              </>
            )}
            <Button onClick={() => done && router.push(`/result/${done.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`)} disabled={!done}>
              내 소리 확인하기
            </Button>
            {!done && <span className="text-xs text-muted">녹음해야 다음으로 넘어가요</span>}
          </div>
        </div>
      </div>
      <Sheet open={exit} onClose={() => setExit(false)} label="중간에 나가기">
        <b className="font-jua text-[24px]">오늘은 여기까지 할까요?</b>
        <p className="text-sm text-sub">
          {p ? `한 만큼(${p.completed}/${p.goal})은 저장돼요.` : '지금까지 한 녹음은 저장돼요.'}
          {p && p.goal - p.completed > 0 && p.goal - p.completed <= 2 ? ` ${p.goal - p.completed}개만 더 하면 오늘 끝이에요.` : ' 홈에서 이어서 할 수 있어요.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => router.push(from ?? '/home')}>
            나가기
          </Button>
          <Button onClick={() => setExit(false)}>계속하기</Button>
        </div>
      </Sheet>
    </AppShell>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Practice />
    </Suspense>
  );
}
