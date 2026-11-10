'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AppShell, BackHeader, Button, Card, ErrorState, Loading, Sheet, cx } from '@/components/ui';
import { LiveBars, MicButton } from '@/features/record/RecordPanel';
import { useRecorder } from '@/hooks/useRecorder';
import { errorText } from '@/services/api';
import { scriptsApi } from '@/services/endpoints';

const SOURCE: Record<string, string> = { pptx: 'PPT', pdf: 'PDF', image: '사진', text: '글' };
const fmt = (s: number) => `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`;

/** 디자인: MyScript · 범위 고르고 읽으면서 녹음하기 / 녹음 파일 올리기 */
export default function ScriptDoc() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const doc = useQuery({ queryKey: ['script', id], queryFn: () => scriptsApi.get(id), refetchInterval: (q) => (q.state.data?.status === 'EXTRACTING' ? 1500 : false) });
  const [range, setRange] = useState<[number, number] | null>(null);
  const [free, setFree] = useState(true);
  const [reading, setReading] = useState(false);
  const [del, setDel] = useState(false);
  const audioIn = useRef<HTMLInputElement>(null);
  const rec = useRecorder(15 * 60_000);
  const send = useMutation({
    mutationFn: ({ blob, name }: { blob: Blob; name: string }) => scriptsApi.createRun(id, blob, name, range![0], range![1], free),
    onSuccess: (r) => router.push(`/script/run/${r.id}`),
  });
  const remove = useMutation({ mutationFn: () => scriptsApi.remove(id), onSuccess: () => (qc.invalidateQueries({ queryKey: ['scripts'] }), router.replace('/script')) });
  if (doc.isLoading) return <Loading />;
  if (doc.error || !doc.data) return <ErrorState message={errorText(doc.error)} onRetry={() => doc.refetch()} />;
  const d = doc.data;
  const slides = d.slides ?? [];
  const r = range ?? (slides.length ? [slides[0].n, slides[Math.min(3, slides.length - 1)].n] : [1, 1]);
  const inRange = slides.filter((s) => s.n >= r[0] && s.n <= r[1]);
  const chars = inRange.reduce((n, s) => n + s.text.replace(/\s/g, '').length, 0);
  const recording = rec.state === 'recording';
  const toggle = async () => {
    if (!range) setRange(r as [number, number]);
    if (recording) {
      const out = await rec.stop();
      setReading(false);
      if (out) send.mutate({ blob: out.wav, name: 'reading.wav' });
      return;
    }
    setReading(true);
    await rec.start();
  };
  return (
    <AppShell tabs={false} wide>
      <BackHeader title="내 글로 연습" href="/script" right={<button type="button" onClick={() => setDel(true)} className="min-h-[44px] px-2 text-xs font-bold text-muted">원고 지우기</button>} />
      {d.status === 'EXTRACTING' && (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="status">
          <b className="font-jua text-[24px]">{SOURCE[d.sourceType] ?? '파일'}에서 글자를 찾고 있어요</b>
          <div className="h-3 w-full max-w-[320px] overflow-hidden rounded-full bg-line">
            <div className="animate-bar h-full rounded-full bg-brand" />
          </div>
        </div>
      )}
      {d.status === 'FAILED' && <ErrorState message={d.error ?? '글을 찾지 못했어요. 다른 파일이나 글 붙여넣기로 해 주세요'} />}
      {d.status === 'READY' && (
        <div className="flex flex-col gap-4 px-5 pb-8 pt-2 lg:grid lg:grid-cols-[1.3fr_1fr] lg:items-start lg:px-0">
          <div className="flex flex-col gap-3">
            <Card className="flex flex-col gap-1">
              <span className="text-xs font-bold text-brand-dark">{SOURCE[d.sourceType] ?? '글'}</span>
              <b className="text-[17px]">{d.title}</b>
              <span className="text-sm text-sub">
                {slides.length > 1 ? `슬라이드 ${slides.length}장 · ` : ''}글자 {d.charCount.toLocaleString()}자 찾았어요
              </span>
            </Card>
            <div className={cx('flex flex-col gap-2', reading && 'text-[19px]')}>
              {slides.map((s) => {
                const on = s.n >= r[0] && s.n <= r[1];
                return (
                  <button
                    key={s.n}
                    type="button"
                    disabled={recording}
                    onClick={() => setRange(s.n < r[0] || !range ? [s.n, Math.max(s.n, r[1])] : s.n === r[0] ? [s.n, s.n] : [r[0], s.n])}
                    className={cx('flex flex-col gap-1 rounded-2xl p-4 text-left', on ? 'bg-white ring-2 ring-brand' : 'bg-white/60 text-muted', reading && !on && 'hidden')}
                  >
                    <span className="text-xs font-bold text-brand-dark">슬라이드 {s.n}</span>
                    <span className={cx('whitespace-pre-line leading-relaxed', reading ? 'text-[19px] text-ink' : 'text-[15px]')}>{s.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:sticky lg:top-4">
            <Card className="flex flex-col gap-2">
              <span className="flex justify-between text-sm">
                <b>
                  슬라이드 {r[0]}~{r[1]}
                </b>
                <span className="text-sub">
                  {inRange.length}장 · 읽는 데 약 {Math.max(1, Math.round(chars / 250))}분
                </span>
              </span>
              <span className="text-xs text-muted">슬라이드를 눌러 시작과 끝을 골라요</span>
              {slides.length > 1 && (
                <button type="button" onClick={() => setRange([slides[0].n, slides[slides.length - 1].n])} disabled={recording} className="self-start text-xs font-bold text-brand-dark">
                  전체 범위 고르기
                </button>
              )}
            </Card>
            <label className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-chip">
              <input type="checkbox" className="h-5 w-5 accent-brand" checked={free} onChange={(e) => setFree(e.target.checked)} disabled={recording} />
              <span className="flex flex-col">
                <b className="text-sm">내 말로 풀어 말해도 괜찮아요</b>
                <span className="text-xs text-muted">원고와 조금 달라도 문맥으로 말하려던 단어를 찾아요</span>
              </span>
            </label>
            {free && <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">발표 연습까지! 진짜 내 말로 해보는 거예요</span>}
            <Card className="flex flex-col items-center gap-3">
              <LiveBars history={rec.history} active={recording} />
              <span className="text-xs font-bold text-muted">{recording ? `녹음 중 ${fmt(rec.elapsed / 1000)} · 최대 15분` : '아직 녹음 전'}</span>
              {send.isPending ? (
                <span className="text-sm font-bold text-brand-dark">올리는 중…</span>
              ) : (
                <MicButton recording={recording} onClick={toggle} label={recording ? '다 읽었으면 멈춤' : '읽으면서 녹음하기'} />
              )}
              {rec.state === 'denied' && <span className="text-xs text-coral-ink">마이크 권한이 꺼져 있어요. 아래 ‘녹음 파일 올리기’로도 할 수 있어요.</span>}
            </Card>
            <input ref={audioIn} type="file" accept="audio/*,.m4a,.mp3,.wav" className="hidden" onChange={(e) => e.target.files?.[0] && (setRange(r as [number, number]), send.mutate({ blob: e.target.files[0], name: e.target.files[0].name }))} />
            <Button variant="outline" onClick={() => audioIn.current?.click()} disabled={recording || send.isPending}>
              이미 녹음한 파일 올리기 · mp3 · m4a · wav
            </Button>
            {send.error && <p role="alert" className="text-sm font-bold text-coral-ink">{errorText(send.error)}</p>}
            {d.runs && d.runs.length > 0 && (
              <Card className="flex flex-col gap-1.5">
                <b className="text-sm">지난 연습</b>
                {d.runs.map((x) => (
                  <Link key={x.id} href={`/script/run/${x.id}`} className="flex justify-between rounded-xl bg-bg px-3 py-2 text-sm">
                    <span>
                      {new Date(x.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} · 슬라이드 {x.slideFrom}~{x.slideTo}
                    </span>
                    <span className="text-muted">{x.status === 'DONE' ? fmt(x.durationMs / 1000) : x.status === 'FAILED' ? '실패' : '분석 중'}</span>
                  </Link>
                ))}
              </Card>
            )}
          </div>
        </div>
      )}
      <Sheet open={del} onClose={() => setDel(false)} label="원고 지우기">
        <b className="font-jua text-[22px]">이 원고와 연습 녹음을 지울까요?</b>
        <p className="text-sm text-sub">지우면 되돌릴 수 없어요.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setDel(false)}>
            그대로 두기
          </Button>
          <Button onClick={() => remove.mutate()} disabled={remove.isPending}>
            지우기
          </Button>
        </div>
      </Sheet>
    </AppShell>
  );
}
