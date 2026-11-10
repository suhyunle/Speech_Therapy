'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, ErrorState, Loading, Logo, cx } from '@/components/ui';
import { errorText } from '@/services/api';
import { listenApi } from '@/services/endpoints';

const MAX_PLAYS = 3;
const FAMS = [
  { v: 'FIRST', t: '처음이에요' },
  { v: 'SOMETIMES', t: '가끔 들어요' },
  { v: 'OFTEN', t: '자주 들어요' },
];

/** 디자인: WebListen · 듣는 사람 받아쓰기 (가입 없이, 정답은 끝난 뒤에) */
export default function ListenPage() {
  const { code } = useParams<{ code: string }>();
  const info = useQuery({ queryKey: ['listen', code], queryFn: () => listenApi.info(code), staleTime: Infinity, retry: false });
  const [n, setN] = useState(1);
  const [plays, setPlays] = useState(0);
  const [text, setText] = useState('');
  const [fam, setFam] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ order: number; target: string; yours: string | null }[] | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    setPlays(0);
    setText('');
  }, [n]);

  if (info.isLoading) return <Loading />;
  if (info.error || !info.data) return <ErrorState message={errorText(info.error)} />;
  const d = info.data;
  const play = () => {
    if (plays >= MAX_PLAYS) return;
    audio.current?.pause();
    audio.current = new Audio(listenApi.audioPath(code, n));
    void audio.current.play().catch(() => setErr('녹음을 재생하지 못했어요'));
    setPlays(plays + 1);
  };
  const submit = async (unsure: boolean) => {
    if (!fam) return setErr('이 사람 말을 들어본 적이 있는지 골라주세요');
    setErr(null);
    try {
      await listenApi.answer(code, { listenerKey: d.listenerKey, order: n, answerText: unsure ? undefined : text, unsure, familiarity: fam });
      if (n < d.count) setN(n + 1);
      else setReveal(await listenApi.reveal(code, d.listenerKey));
    } catch (e) {
      setErr(errorText(e));
    }
  };

  return (
    <main className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-[720px] items-center justify-between px-6 py-5">
        <Logo />
        <span className="text-sm font-bold text-sub">받아쓰기 부탁 · 가입 없이 바로</span>
      </header>
      <div className="mx-auto flex max-w-[560px] flex-col gap-4 px-5 pb-10">
        {reveal ? (
          <Card className="flex flex-col gap-3">
            <h1 className="font-jua text-[26px]">고마워요! 정답은 이거였어요</h1>
            {reveal.map((r) => (
              <div key={r.order} className="flex items-center justify-between rounded-2xl bg-bg px-4 py-3 text-[15px]">
                <span>
                  정답 <b>{r.target}</b>
                </span>
                <span className="text-sub">내가 적은 것 {r.yours ?? '모르겠어요'}</span>
              </div>
            ))}
            <span className="text-xs text-muted">적어주신 답은 이 사람의 발음 연습에만 쓰여요.</span>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-jua text-[26px]">녹음을 듣고, 들린 그대로 적어주세요</h1>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-bold">
                {n} / {d.count}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-sub">정답은 다 끝난 뒤에 보여드려요. 맞춤법이나 띄어쓰기는 신경 쓰지 않아도 돼요. 잘 모르겠으면 들린 만큼만 적어주세요.</p>
            <Card className="flex items-center gap-4">
              <button type="button" onClick={play} disabled={plays >= MAX_PLAYS} aria-label="녹음 듣기" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-node disabled:bg-line2 disabled:shadow-none">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
              <span className="text-sm text-sub">
                {d.items[n - 1]?.durationMs ? `${(d.items[n - 1].durationMs! / 1000).toFixed(1)}초 · ` : ''}
                {MAX_PLAYS - plays}번 더 들을 수 있어요
              </span>
            </Card>
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              들린 대로
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} className="h-14 rounded-2xl border-2 border-line bg-white px-4 text-lg font-normal outline-none focus:border-brand" />
            </label>
            <Card className="flex flex-col gap-2">
              <b className="text-sm">이 사람 말을 들어본 적이 있나요?</b>
              <div role="radiogroup" className="flex flex-wrap gap-2">
                {FAMS.map((f) => (
                  <button key={f.v} type="button" role="radio" aria-checked={fam === f.v} onClick={() => setFam(f.v)} className={cx('min-h-[44px] rounded-full px-4 text-sm font-bold', fam === f.v ? 'bg-ink text-white' : 'bg-bg text-sub')}>
                    {f.t}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted">한 번만 물어봐요 · 결과를 나눠 볼 때만 써요</span>
            </Card>
            {err && <p role="alert" className="text-sm font-bold text-coral-ink">{err}</p>}
            <div className="grid grid-cols-[1fr_1.4fr] gap-2">
              <Button variant="outline" onClick={() => submit(true)} disabled={plays === 0}>
                잘 안 들려서 모르겠어요
              </Button>
              <Button onClick={() => submit(false)} disabled={plays === 0 || !text.trim()}>
                {n < d.count ? '다음 녹음' : '끝내고 정답 보기'}
              </Button>
            </div>
            <span className="text-center text-xs text-muted">녹음은 받아쓰기에만 쓰이고 저장되지 않아요 · 이 링크는 7일 뒤 사라져요</span>
          </>
        )}
      </div>
    </main>
  );
}
