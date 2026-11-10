'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppShell, BackHeader, Button, Card, Chip, ErrorState, Icon, Loading, Sheet, Svg, cx } from '@/components/ui';
import { Heard } from '@/features/record/Heard';
import { SoundShape } from '@/features/record/RecordPanel';
import { ExerciseResult } from '@/features/voice/ExerciseResult';
import { VowelMap } from '@/features/vowels/VowelMap';
import { audioUrl, errorText } from '@/services/api';
import { attemptsApi, planApi } from '@/services/endpoints';
import type { AnalysisResult, Op } from '@/types/api';

const TYPE_LABEL: Record<string, { label: string; cell: string; text: string }> = {
  same: { label: '통과', cell: 'bg-pass text-white shadow-pass', text: 'text-pass-text' },
  allowed: { label: '통과', cell: 'bg-pass text-white shadow-pass', text: 'text-pass-text' },
  sub: { label: '바뀜', cell: 'bg-coral text-ink shadow-coral', text: 'text-coral-ink' },
  del: { label: '빠짐', cell: 'bg-coral-soft text-coral-ink border-2 border-dashed border-coral-light', text: 'text-coral-ink' },
  ins: { label: '더해짐', cell: 'bg-coral-soft text-coral-ink', text: 'text-coral-ink' },
  unsure: { label: '확실 X', cell: 'bg-tint text-muted border-2 border-dashed border-line2', text: 'text-muted' },
};

function Grid({ ops }: { ops: Op[] }) {
  const shown = ops.slice(0, 16);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(shown.length, 6)}, minmax(0, 1fr))` }}>
      {shown.map((o, i) => {
        const t = TYPE_LABEL[o.type];
        return (
          <div key={i} className="flex flex-col items-center gap-1" aria-label={`정답 ${o.target?.symbol ?? '없음'}, 내 소리 ${o.got?.symbol ?? '없음'}, ${t.label}`}>
            <span className="flex h-9 w-full items-center justify-center rounded-xl bg-bg font-jua text-[20px]">{o.target?.symbol ?? '·'}</span>
            <span className={cx('flex h-9 w-full items-center justify-center rounded-xl font-jua text-[20px]', t.cell)}>{o.type === 'unsure' ? `${o.target?.symbol}?` : o.got?.symbol ?? '—'}</span>
            <span className={cx('text-[11px] font-bold', t.text)}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Meter({ label, state, pos }: { label: string; state: string | null; pos: number | null }) {
  const ok = state === 'ok';
  const text = state === null ? '확인 못 함' : ok ? '적당해요' : state === 'low' ? '조금 작아요' : state === 'high' ? '조금 높아요' : state === 'slow' ? '조금 느려요' : state === 'fast' ? '조금 빨라요' : state;
  return (
    <>
      <span className="text-sub">{label}</span>
      <div aria-hidden className="relative h-2.5 rounded-full bg-line">
        <div className="absolute inset-y-0 left-[35%] w-[30%] rounded-full bg-pass-range" />
        {pos !== null && <div className={cx('absolute -top-1 -ml-[9px] h-[18px] w-[18px] rounded-full border-[3px] border-white', ok ? 'bg-pass' : 'bg-coral')} style={{ left: `${Math.max(4, Math.min(96, pos))}%` }} />}
      </div>
      <span className={cx('text-right font-bold', state === null ? 'text-muted' : ok ? 'text-pass-text' : 'text-coral-ink')}>{text}</span>
    </>
  );
}
const posOf = (s: string | null) => (s === null ? null : s === 'ok' ? 50 : s === 'low' || s === 'slow' ? 20 : 80);

/** 디자인: Result · 내 소리 확인 */
function Result() {
  const { id } = useParams<{ id: string }>();
  const from = useSearchParams().get('from');
  const [why, setWhy] = useState(false);
  const router = useRouter();
  const a = useQuery({ queryKey: ['attempt', id], queryFn: () => attemptsApi.get(id) });
  const plan = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  const [help, setHelp] = useState(false);
  const [report, setReport] = useState(false);
  const [reported, setReported] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);

  const node = plan.data?.path.find((p) => p.symbol === a.data?.soundSymbol);
  useEffect(() => {
    if (a.data?.passed === false && (node?.consecutiveFails ?? 0) >= 3) setHelp(true);
  }, [a.data?.passed, node?.consecutiveFails]);

  if (a.isLoading) return <Loading />;
  if (a.error || !a.data) return <ErrorState message={errorText(a.error)} onRetry={() => a.refetch()} />;
  const at = a.data;
  const r = at.result as AnalysisResult | null;
  const next = plan.data?.items.find((i) => !i.done && i.id !== at.itemId);
  const goalDone = plan.data ? plan.data.completed >= plan.data.goal : false;
  const sym = at.soundSymbol;
  const goNext = () => router.push(from ? from : goalDone || !next ? '/complete' : `/practice/${next.id}${sym ? `?sound=${encodeURIComponent(sym)}` : ''}`);
  const retry = () =>
    at.itemId ? router.push(`/practice/${at.itemId}${sym ? `?sound=${encodeURIComponent(sym)}` : ''}`) : router.push(`/practice/custom?text=${encodeURIComponent(at.targetText)}${from ? `&from=${encodeURIComponent(from)}` : ''}`);
  const unsure = r?.phonemes?.ops.filter((o) => o.type === 'unsure') ?? [];
  const okCount = r?.phonemes?.ops.filter((o) => o.target && (o.type === 'same' || o.type === 'allowed')).length ?? 0;
  const tgtCount = r?.phonemes?.ops.filter((o) => o.target).length ?? 0;
  const isExercise = at.context === 'EXERCISE';
  const good = r?.phonemes?.ops.filter((o) => o.target && (o.type === 'same' || o.type === 'allowed')).map((o) => o.target!.symbol) ?? [];
  const goodVowels = [...new Set(good.filter((s) => !'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.includes(s)))];
  const v = r?.voice;
  const hiss = r?.measures?.hiss;

  const play = async () => {
    try {
      const url = audio ?? (await audioUrl(`/attempts/${id}/audio`));
      setAudio(url);
      void new Audio(url).play();
    } catch (e) {
      alert(errorText(e));
    }
  };

  return (
    <AppShell tabs={false} wide>
      <BackHeader progress={plan.data ? Math.min(1, plan.data.completed / plan.data.goal) : 1} href={from ?? undefined} />
      <div className="pb-8 lg:grid lg:grid-cols-[1fr_1fr] lg:gap-6">
      <div className="flex flex-col">
      <div className="flex flex-col gap-1 px-6 pt-4">
        <span className={cx('text-[13px] font-bold', at.passed ? 'text-pass-text' : 'text-coral-ink')}>
          “{at.targetText}” · {r?.feedback?.headline ?? '결과'}
        </span>
        <span className="font-jua text-[28px] leading-tight">{r?.feedback?.cheer}</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {goodVowels.length > 0 && <Chip tone="pass">{goodVowels.slice(0, 3).join('·')} 정확해요</Chip>}
          {v?.loudness === 'ok' && <Chip tone="pass">크기 딱 좋아요</Chip>}
          {at.tryNumber && <Chip>{at.tryNumber}번째 도전</Chip>}
          {tgtCount > 0 && <Chip tone="muted">{tgtCount}소리 중 {okCount}개 통과</Chip>}
        </div>
      </div>
      <section aria-label="들린 대로" className="mx-5 mt-3.5 flex items-center justify-between gap-2.5 rounded-[22px] bg-ink px-[18px] py-3 text-white">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold text-[#C8C5DD]">정답</span>
          <span className="font-jua text-[28px]">{at.targetText}</span>
        </div>
        <Svg size={22} stroke={2.6} className="text-[#C8C5DD]">
          {Icon.next}
        </Svg>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[11px] font-bold text-[#C8C5DD]">실제로 낸 소리</span>
          <Heard target={at.targetText} heard={at.heard} className="font-jua text-[28px]" />
        </div>
      </section>
      {r?.phonemes && (
        <Card className="mx-5 mt-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold">한 소리씩 비교</span>
            <span className="text-[11px] text-muted">위: 정답 · 아래: 내 소리</span>
          </div>
          <Grid ops={r.phonemes.ops} />
          {r.acousticChecks && r.acousticChecks.length > 0 && (
            <p className="rounded-xl bg-tint px-3 py-2 text-xs leading-relaxed text-sub">
              <b>소리를 직접 재 봤어요 · </b>
              {r.acousticChecks[0].reason === 'no_hiss'
                ? `받아쓰기는 ${r.acousticChecks.map((c) => c.symbol).join('·')}으로 들었지만, 녹음에 바람 소리가 거의 없었어요(${r.acousticChecks[0].hissSec}초). 막혀서 ㄷ처럼 났을 수 있어 맞다고 정하지 않았어요.`
                : `받아쓰기는 ${r.acousticChecks.map((c) => c.symbol).join('·')}으로 들었지만, 바람 소리 중심이 ${r.acousticChecks[0].centroidKHz}kHz로 낮았어요(ㅅ 목표 6~8.5). ‘쉬’처럼 났을 수 있어 맞다고 정하지 않았어요.`}
            </p>
          )}
          {unsure.length > 0 && (
            <button type="button" onClick={() => setWhy(true)} className="self-start text-xs font-bold text-brand-dark">
              {unsure.map((o) => o.target?.symbol).join('·')}은 왜 ‘확실하지 않음’이에요? →
            </button>
          )}
        </Card>
      )}
      {r?.measures?.shape && r.measures.shape.length > 0 && (
        <Card className="mx-5 mt-3">
          <SoundShape shape={r.measures.shape} />
        </Card>
      )}
      {r?.vowelPoint && (
        <Card className="mx-5 mt-3 flex flex-col gap-2">
          <span className="text-[13px] font-bold">모음 위치 {r.vowelPoint.target ? `· 목표 ${r.vowelPoint.target}` : ''}</span>
          <VowelMap set={r.vowelPoint.set === 'm' ? 'm' : 'f'} target={r.vowelPoint.target} point={r.vowelPoint} targets={r.vowelPoint.targets} />
          <span className="text-xs text-sub">{r.vowelPoint.target && r.vowelPoint.nearest !== r.vowelPoint.target ? `${r.vowelPoint.nearest} 쪽으로 찍혔어요` : `${r.vowelPoint.nearest} 칸 가까이 찍혔어요`} · 점수 대신 위치만 보여드려요</span>
        </Card>
      )}
      {r?.exercise && (
        <Card className="mx-5 mt-3">
          <ExerciseResult result={r} text={at.targetText} pronunciation={at.targetPronunciation} />
        </Card>
      )}
      </div>
      <div className="flex flex-col">
      <Card className="mx-5 mt-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold">목소리 상태</span>
          {v?.reason === 'no_baseline' && <span className="text-[11px] text-muted">기준 목소리를 녹음하면 비교해요</span>}
        </div>
        <div className="grid grid-cols-[44px_1fr_80px] items-center gap-2.5 text-[13px]">
          <Meter label="크기" state={v?.loudness ?? null} pos={posOf(v?.loudness ?? null)} />
          <Meter label="높이" state={v?.pitch ?? null} pos={posOf(v?.pitch ?? null)} />
          {v?.rate !== undefined && v?.rate !== null && <Meter label="빠르기" state={v.rate} pos={posOf(v.rate)} />}
          {hiss && (
            <>
              <span className="text-sub">바람</span>
              <div aria-hidden className="relative h-2.5 rounded-full bg-line">
                <div className="absolute inset-y-0 left-[60%] right-[5%] rounded-full bg-pass-range" />
                {hiss.centroidKHz !== null && <div className={cx('absolute -top-1 -ml-[9px] h-[18px] w-[18px] rounded-full border-[3px] border-white', hiss.centroidKHz >= 6 ? 'bg-pass' : 'bg-coral')} style={{ left: `${Math.min(96, (hiss.centroidKHz / 10) * 100)}%` }} />}
              </div>
              <span className={cx('text-right font-bold', hiss.centroidKHz && hiss.centroidKHz >= 6 ? 'text-pass-text' : 'text-coral-ink')}>{hiss.centroidKHz ? `${hiss.centroidKHz} kHz` : '바람 없음'}</span>
            </>
          )}
        </div>
        {r?.measures?.endDrop && <span className="text-xs font-bold text-coral-ink">문장 끝소리가 작아졌어요</span>}
      </Card>
      {r?.feedback?.tip && (
        <p className="mx-5 mt-3 rounded-2xl bg-brand-soft px-4 py-3 text-sm leading-relaxed text-brand-deep">
          <b>이렇게 해봐요 · </b>
          {r.feedback.tip}
        </p>
      )}
      <div className="mx-5 mt-2 flex items-center justify-between text-xs text-muted">
        <button type="button" onClick={play} disabled={!at.audioAvailable} className="min-h-[44px] font-bold text-brand-dark disabled:text-faint">
          {at.audioAvailable ? '내 녹음 다시 듣기' : '원본은 보관 기간이 지나 지웠어요'}
        </button>
        <button type="button" onClick={() => setReport(true)} className="min-h-[44px] font-bold" disabled={reported}>
          {reported ? '알려주셔서 고마워요' : '결과가 이상해요'}
        </button>
      </div>
      {r?.limits?.includes('word_level_asr') && <p className="mx-5 text-[11px] leading-relaxed text-faint">들린 대로는 한국어 받아쓰기 모델 결과예요. 실제 단어 쪽으로 기울 수 있어서, 정확한 판단은 ‘사람 귀 확인’으로 함께 봐요.</p>}
      {!isExercise && at.context !== 'BASELINE' && (
        <Card className="mx-5 mt-3 flex items-center justify-between gap-3">
          <span className="text-sm leading-relaxed">
            <b>사람 귀로 확인받기</b>
            <br />
            <span className="text-sub">믿는 사람에게 보내면, 정답을 모른 채 들린 대로 적어줘요.</span>
          </span>
          <Button href={`/share?ids=${at.id}`} variant="outline" className="w-auto shrink-0 px-4">
            링크 만들기
          </Button>
        </Card>
      )}
      <div className="mt-auto flex flex-col gap-2 px-5 pt-5">
        <div className="grid grid-cols-[1fr_1.4fr] gap-2">
          {sym ? (
            <Button variant="outline" href={`/learn/${encodeURIComponent(sym)}`}>
              {sym} 다시 배우기
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={retry}>다시 녹음</Button>
        </div>
        <Button variant="ghost" onClick={goNext}>
          {at.passed ? (goalDone || !next ? '오늘 학습 마치기' : '다음 단어로') : goalDone || !next ? '나중에 하고 마치기' : '나중에 하고 다음으로 넘어가기'}
        </Button>
      </div>

      <Sheet open={help} onClose={() => setHelp(false)} label="3번 연속 어려울 때">
        <b className="font-jua text-[24px]">{sym}이 계속 어렵죠? 괜찮아요</b>
        <p className="text-sm text-sub">누구나 오래 걸리는 소리예요. {goodVowels.length ? `${goodVowels.join('·')}는 정확했어요.` : ''}</p>
        <div className="flex flex-col gap-2">
          {sym && (
            <Button variant="outline" href={`/learn/${encodeURIComponent(sym)}`}>
              그림으로 다시 보기
            </Button>
          )}
          <Button onClick={() => (setHelp(false), goNext())}>이 단어는 내일 다시 · 다른 단어로</Button>
        </div>
      </Sheet>
      <Sheet open={why} onClose={() => setWhy(false)} label="확실하지 않아요">
        <b className="font-jua text-[22px]">{unsure.map((o) => o.target?.symbol).join('·')}은 확실하지 않아요</b>
        <p className="text-sm leading-relaxed text-sub">
          {unsure.some((o) => o.reason) ? '받아쓰기와 녹음에서 직접 잰 바람 소리가 서로 맞지 않으면 맞다·틀리다를 정하지 않아요. ' : ''}
          소리가 짧거나 애매하면 맞다·틀리다를 정하지 않아요. 틀렸다고 세지도 않아요.
        </p>
        <div className="flex gap-2 text-xs">
          <span className="rounded-lg bg-pass px-2 py-1 font-bold text-white">확실 · 맞음</span>
          <span className="rounded-lg bg-coral px-2 py-1 font-bold">확실 · 다름</span>
          <span className="rounded-lg border-2 border-dashed border-line2 bg-tint px-2 py-1 font-bold text-muted">확실하지 않음</span>
        </div>
        <Button onClick={() => (setWhy(false), retry())}>다시 녹음해서 확인</Button>
        <Button variant="outline" href={`/share?ids=${at.id}`}>
          사람에게 들려주기
        </Button>
      </Sheet>
      <ReportSheet open={report} onClose={() => setReport(false)} onSend={async (reason) => (await attemptsApi.report(id, reason), setReported(true), setReport(false))} />
      </div>
      </div>
    </AppShell>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Result />
    </Suspense>
  );
}

function ReportSheet({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (r: string) => Promise<void> }) {
  const reasons = ['맞게 말했는데 다르다고 나와요', '다르게 말했는데 맞다고 나와요', '들린 대로 글자가 이상해요', '녹음 문제가 아닌데 다시 하래요'];
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} label="결과가 이상해요">
      <b className="font-jua text-[22px]">어떤 점이 이상했나요?</b>
      <p className="text-xs text-muted">알려주기 · 이 녹음은 개선에만 써요. 이 녹음의 결과 글자만 함께 보내요.</p>
      {reasons.map((r) => (
        <Button key={r} variant="outline" disabled={busy} onClick={async () => (setBusy(true), await onSend(r).finally(() => setBusy(false)))}>
          {r}
        </Button>
      ))}
    </Sheet>
  );
}
