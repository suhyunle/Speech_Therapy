'use client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AppShell, BackHeader, Button, Card, Chip, ErrorState, Loading, Sheet, cx } from '@/components/ui';
import { Heard } from '@/features/record/Heard';
import { Analyzing, IssueBox, LiveBars, MicButton, OfflineBox, useAttemptFlow } from '@/features/record/RecordPanel';
import { errorText } from '@/services/api';
import { meApi, placementApi } from '@/services/endpoints';
import type { Attempt, LessonItem, PlacementStart } from '@/types/api';

const STAGE_NAME = { SYLLABLE: '글자', WORD: '단어', SENTENCE: '문장' } as const;
const STAGE_HINT = { SYLLABLE: '한 글자를 또박또박', WORD: '평소 말하듯 자연스럽게', SENTENCE: '끊지 말고 이어서 읽어요' } as const;
const CHEERS = ['잘하고 있어요!', '좋아요, 이 속도로!', '끝까지 말한 것부터 잘했어요!', '하나씩 차근차근!', '벌써 여기까지 왔어요!'];

/** 디자인: PlacementIntro → PlacementSyllable → PlacementWord → PlacementSentence */
export default function PlacementPage() {
  const router = useRouter();
  const [data, setData] = useState<PlacementStart | null>(null);
  const start = useMutation({ mutationFn: placementApi.start, onSuccess: setData });
  const skip = async () => {
    await meApi.updateSettings({ onboarded: true });
    router.push('/order');
  };

  if (!data)
    return (
      <AppShell tabs={false}>
        <BackHeader href="/home" />
        <div className="flex flex-1 flex-col gap-4 px-6 pt-2">
          <p className="text-[15px] leading-relaxed text-sub">
            안녕하세요! 먼저 지금 발음을
            <br />4분 정도 살펴볼게요.
          </p>
          <h1 className="font-jua text-[30px] leading-tight">
            3단계 진단으로
            <br />
            시작해요
          </h1>
          {[
            { big: '가', t: '1 · 글자', d: '자음 13 + 모음 10 · 사, 라, 어, 오처럼', m: '2분' },
            { big: '사과', t: '2 · 단어', d: '사과, 라면처럼 짧은 단어 · 8개', m: '1분' },
            { big: '…', t: '3 · 문장', d: '일상 문장을 이어서 읽기 · 3개', m: '1분' },
          ].map((s) => (
            <Card key={s.t} className="flex items-center gap-3.5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft font-jua text-[22px] text-brand-dark">{s.big}</span>
              <span className="flex flex-1 flex-col">
                <b className="text-[15px]">{s.t}</b>
                <span className="text-[13px] text-sub">{s.d}</span>
              </span>
              <Chip tone="muted">{s.m}</Chip>
            </Card>
          ))}
          <p className="rounded-2xl bg-pass-soft px-4 py-3 text-[13px] leading-relaxed text-pass-ink">
            세 단계에서 모두 통과한 <b>자음·모음</b>은 처음부터 클리어해 둘게요. 말하면 들린 그대로 글자로 보여드려요.
          </p>
          {start.error && <p role="alert" className="text-sm font-bold text-coral-ink">{errorText(start.error)}</p>}
        </div>
        <div className="flex flex-col gap-2 px-6 pb-8 pt-4">
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            진단 시작
          </Button>
          <Button variant="ghost" onClick={skip}>
            건너뛰고 처음부터 배우기
          </Button>
        </div>
      </AppShell>
    );
  return <Run data={data} />;
}

function Run({ data }: { data: PlacementStart }) {
  const router = useRouter();
  const items = useMemo(() => data.stages.flatMap((s) => s.items), [data]);
  const [idx, setIdx] = useState(0);
  const [last, setLast] = useState<Attempt | null>(null);
  // 지금까지 결과 (WebPlacement 오른쪽): 소리마다 또렷했는지
  const [soFar, setSoFar] = useState<Record<string, boolean>>({});
  const [clearCount, setClearCount] = useState(0);
  const [exit, setExit] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const item: LessonItem = items[idx];
  const kind = item.kind as keyof typeof STAGE_NAME;
  const stageItems = items.filter((i) => i.kind === kind);
  const posInStage = stageItems.indexOf(item) + 1;
  const flow = useAttemptFlow({ context: 'PLACEMENT', itemId: item.id, placementSessionId: data.session.id, targetText: item.text }, (a) => {
    if (a.status !== 'DONE') return;
    setLast(a);
    const ops = a.result?.phonemes?.ops ?? [];
    const next: Record<string, boolean> = {};
    for (const o of ops) if (o.target && o.target.pos !== 'coda') next[o.target.symbol] = (next[o.target.symbol] ?? true) && (o.type === 'same' || o.type === 'allowed');
    setSoFar((prev) => {
      const merged = { ...prev };
      for (const [k, v] of Object.entries(next)) merged[k] = (merged[k] ?? true) && v;
      return merged;
    });
    if (ops.length && ops.every((o) => !o.target || o.type === 'same' || o.type === 'allowed')) setClearCount((c) => c + 1);
  });

  const next = async () => {
    setLast(null);
    flow.reset();
    if (idx + 1 < items.length) return setIdx(idx + 1);
    setFinishing(true);
    try {
      const summary = await placementApi.finish(data.session.id);
      sessionStorage.setItem('malang-placement', JSON.stringify(summary));
      await meApi.updateSettings({ onboarded: true });
      router.replace('/placement/result');
    } catch (e) {
      setErr(errorText(e));
      setFinishing(false);
    }
  };

  if (finishing) return <Loading text="진단 결과를 정리하고 있어요" />;
  if (err) return <ErrorState message={err} onRetry={next} />;
  const busy = flow.phase === 'uploading' || flow.phase === 'analyzing';

  return (
    <AppShell tabs={false} wide>
     <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[1fr_340px] lg:gap-8">
     <div className="flex flex-1 flex-col">
      <BackHeader progress={(idx + (last ? 1 : 0)) / items.length} right={<button type="button" onClick={() => setExit(true)} className="min-h-[44px] text-sm font-bold text-muted">나가기</button>} />
      <div className="flex gap-1.5 px-5 pt-3">
        {(['SYLLABLE', 'WORD', 'SENTENCE'] as const).map((k) => {
          const doneStage = items.findIndex((i) => i.kind === k) < idx && k !== kind;
          return (
            <span key={k} className={cx('flex h-9 flex-1 items-center justify-center rounded-xl text-[13px] font-bold', k === kind ? 'bg-brand text-white shadow-[0_3px_0_#3F31D6]' : doneStage ? 'bg-lime text-lime-ink' : 'bg-white text-faint')}>
              {doneStage ? `${STAGE_NAME[k]} 완료` : STAGE_NAME[k]}
            </span>
          );
        })}
      </div>
      <div className="flex flex-col gap-1 px-6 pt-4">
        <span className="text-[13px] font-bold text-brand-dark">
          {kind === 'SYLLABLE' ? '1' : kind === 'WORD' ? '2' : '3'}단계 · {STAGE_NAME[kind]} {posInStage}/{stageItems.length}
        </span>
        <h1 className="font-jua text-[24px]">{STAGE_HINT[kind]}</h1>
        <span className="self-start rounded-full bg-pass-soft px-2.5 py-1 text-xs font-bold text-pass-ink">{CHEERS[idx % CHEERS.length]}</span>
      </div>
      <Card className="mx-5 mt-4 flex flex-col items-center gap-3 rounded-[30px] px-5 py-7 shadow-[0_6px_0_#E6E3F2]">
        <span className={cx('text-center font-jua leading-tight', kind === 'SENTENCE' ? 'text-[32px]' : kind === 'WORD' ? 'text-[64px] tracking-[0.15em]' : 'text-[88px]')}>{item.text}</span>
        {item.note && <Chip tone="muted">{item.note}</Chip>}
        {flow.phase === 'recording' && <LiveBars history={flow.rec.history} active />}
      </Card>
      <div className="flex flex-1 flex-col gap-3 px-5 pt-4">
        {busy && <Analyzing />}
        {flow.phase === 'issue' && flow.issue && <IssueBox issue={flow.issue} onRetry={flow.reset} />}
        {flow.phase === 'offline' && <OfflineBox />}
        {flow.error && <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-bold text-coral-ink">{flow.error}</p>}
        {last && (
          <section aria-label="들린 대로" className="flex flex-col gap-1 rounded-[22px] bg-ink px-5 py-4 text-white">
            <span className="text-[11px] font-bold text-[#C8C5DD]">들린 대로 · 보정 없이</span>
            <Heard target={item.text} heard={last.heard} className="font-jua text-[28px]" />
            <span className="text-[11px] text-[#C8C5DD]">주황 = 목표와 다르게 들린 글자</span>
          </section>
        )}
      </div>
      <div className="flex flex-col items-center gap-2 px-5 pb-8 pt-4">
        {last ? (
          <div className="grid w-full grid-cols-[1fr_1.6fr] gap-2">
            <Button variant="outline" onClick={() => (setLast(null), flow.reset())}>
              다시
            </Button>
            <Button onClick={next}>{idx + 1 === items.length ? '진단 끝내기' : '다음'}</Button>
          </div>
        ) : (
          flow.phase !== 'issue' && <MicButton recording={flow.rec.state === 'recording'} onClick={flow.toggle} disabled={busy} />
        )}
        {!last && (
          <Button variant="ghost" onClick={next} disabled={busy || flow.rec.state === 'recording'}>
            아직 어려워요 · 건너뛰기
          </Button>
        )}
      </div>
     </div>
      <aside className="hidden flex-col gap-3 pt-8 lg:flex" aria-label="지금까지 결과">
        <Card className="flex flex-col gap-3">
          <b className="text-sm">지금까지 결과</b>
          <div className="grid grid-cols-7 gap-1.5">
            {'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split('').map((c) => (
              <span key={c} className={cx('flex h-9 items-center justify-center rounded-lg font-jua text-lg', item.targetSounds.includes(c) ? 'bg-brand text-white' : soFar[c] === true ? 'bg-pass text-white' : soFar[c] === false ? 'bg-coral-soft text-coral-ink' : 'bg-bg text-faint')}>
                {c}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ'.split('').map((c) => (
              <span key={c} className={cx('flex h-9 items-center justify-center rounded-lg font-jua text-lg', item.targetSounds.includes(c) ? 'bg-brand text-white' : soFar[c] === true ? 'bg-pass text-white' : soFar[c] === false ? 'bg-coral-soft text-coral-ink' : 'bg-bg text-faint')}>
                {c}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-sub">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-pass" />또렷해요</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-coral-soft" />다시 볼 소리</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-brand" />지금</span>
          </div>
        </Card>
        {clearCount > 0 && <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">여기까지 {clearCount}개 또렷했어요. 잘하고 있어요!</span>}
        <p className="text-xs leading-relaxed text-muted">세 단계 모두 또렷한 소리는 ‘이미 발음이 좋아요’로 미리 통과돼요. 점수 대신 들린 대로만 보여드려요.</p>
        <button type="button" onClick={() => setExit(true)} className="self-start text-sm font-bold text-muted">
          나중에 이어서 하기
        </button>
      </aside>
     </div>
      <Sheet open={exit} onClose={() => setExit(false)} label="중간에 나가기">
        <b className="font-jua text-[24px]">진단을 그만할까요?</b>
        <p className="text-sm text-sub">지금까지 녹음한 것은 저장돼요. 다음에 처음부터 다시 진단해요.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => router.push('/home')}>
            나가기
          </Button>
          <Button onClick={() => setExit(false)}>계속하기</Button>
        </div>
      </Sheet>
    </AppShell>
  );
}
