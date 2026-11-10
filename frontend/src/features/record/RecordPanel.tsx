'use client';
import { useState } from 'react';
import { Button, Icon, Svg, cx } from '@/components/ui';
import { useRecorder, type Recording } from '@/hooks/useRecorder';
import { errorText, HttpError } from '@/services/api';
import { attemptsApi } from '@/services/endpoints';
import { newClientId, notifyQueueChanged, offlineQueue } from '@/utils/offline';
import type { Attempt, AttemptContext } from '@/types/api';

export const ISSUE_TEXT: Record<string, { title: string; steps: string[] }> = {
  too_quiet: { title: '소리가 너무 작았어요', steps: ['휴대폰을 입에서 한 뼘 거리로', '평소보다 조금 더 크게'] },
  too_short: { title: '말소리가 너무 짧았어요', steps: ['버튼을 누르고 끝까지 이어서 말해요', '다 말한 뒤에 멈춤을 눌러요'] },
  clipped: { title: '소리가 너무 커서 깨졌어요', steps: ['입에서 조금 떨어져요', '평소 크기로 말해요'] },
  noisy: { title: '주변이 시끄러워요', steps: ['조용한 곳으로 옮겨요', 'TV·음악을 잠깐 꺼요'] },
  mismatch: { title: '다른 말처럼 들렸어요', steps: ['정답 단어를 한 번 더 보고', '천천히 다시 말해요'] },
};

/** 실시간 크기 막대 (기기 계산, 표시용) */
export function LiveBars({ history, active }: { history: number[]; active: boolean }) {
  const bars = Array.from({ length: 40 }, (_, i) => history[history.length - 40 + i] ?? 0);
  return (
    <div className="flex h-16 items-center gap-[3px]" aria-hidden>
      {bars.map((v, i) => (
        <span key={i} className={cx('w-full rounded-full transition-[height]', active ? 'bg-brand' : 'bg-line2')} style={{ height: `${Math.max(6, v * 100)}%` }} />
      ))}
    </div>
  );
}

/** ㅅ 쉬익 미터 — 기기에서 4kHz 위 에너지 비율로 그린다 (기록에 남는 값은 서버 계산) */
export function HissMeter({ value }: { value: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs font-bold">
        <span className="text-coral-ink">쉬익 미터 · 바람 높이</span>
        <span className="text-muted">{value > 0.5 ? '바람 소리 들어와요' : value > 0.2 ? '조금 더 가늘게' : '아직 바람 소리가 없어요'}</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-line">
        <div className="absolute inset-y-0 left-[55%] right-0 bg-pass-range" />
        <div className="absolute inset-y-0 left-0 rounded-full bg-coral transition-all" style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
    </div>
  );
}

export type Phase = 'idle' | 'recording' | 'uploading' | 'analyzing' | 'issue' | 'error' | 'offline';

/**
 * 녹음 → 기기 검사 → 업로드 → 분석 대기. 녹음해야 다음으로 넘어간다.
 * onDone 은 분석이 끝난(DONE/ISSUE) 시도를 받는다.
 */
export function useAttemptFlow(
  meta: { context: AttemptContext; itemId?: string; placementSessionId?: string; soundSymbol?: string; text?: string; targetText?: string },
  onDone: (a: Attempt) => void,
  opts: { formants?: boolean; maxMs?: number } = {},
) {
  const rec = useRecorder(opts.maxMs ?? 15_000, { formants: opts.formants });
  const [phase, setPhase] = useState<Phase>('idle');
  const [issue, setIssue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (rec.state === 'recording') {
      const r = await rec.stop();
      if (r) await submit(r);
      return;
    }
    setIssue(null);
    setError(null);
    await rec.start();
    setPhase('recording');
  };

  const submit = async (r: Recording) => {
    if (r.precheck) {
      setIssue(r.precheck);
      setPhase('issue');
      return;
    }
    setPhase('uploading');
    const clientId = newClientId();
    const { targetText, ...apiMeta } = meta;
    try {
      let created;
      try {
        created = await attemptsApi.create(r.wav, { ...apiMeta, clientId, durationMs: r.durationMs });
      } catch (e) {
        if (e instanceof HttpError && e.code === 'OFFLINE') {
          // 인터넷이 끊겼어요: 녹음은 이 기기에 보관, 연결되면 자동으로 올려요
          await offlineQueue.add({ clientId, wav: r.wav, targetText: targetText ?? meta.text ?? '', meta: { ...apiMeta, durationMs: r.durationMs }, createdAt: Date.now() });
          notifyQueueChanged();
          setPhase('offline');
          return;
        }
        throw e;
      }
      setPhase('analyzing');
      const done = await attemptsApi.waitFor(created.id, () => undefined);
      if (done.status === 'FAILED') throw new Error('분석하다 문제가 생겼어요. 다시 녹음해 주세요');
      if (done.status === 'ISSUE' && done.issue) {
        setIssue(done.issue);
        setPhase('issue');
      } else setPhase('idle');
      onDone(done);
    } catch (e) {
      setError(e instanceof HttpError ? e.message : e instanceof Error ? e.message : errorText(e));
      setPhase('error');
    }
  };

  return { rec, phase, issue, error, toggle, reset: () => (setPhase('idle'), setIssue(null), setError(null)) };
}

export function MicButton({ recording, disabled, onClick, label }: { recording: boolean; disabled?: boolean; onClick: () => void; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={recording}
        aria-label={recording ? '녹음 멈추기' : '녹음 시작'}
        className={cx(
          'relative flex h-[84px] w-[84px] items-center justify-center rounded-full text-white transition-transform active:translate-y-[3px] disabled:bg-line2 disabled:shadow-none',
          recording ? 'bg-coral shadow-[0_6px_0_#D9481A]' : 'bg-brand shadow-node',
        )}
      >
        {recording && <span className="animate-ring absolute inset-0 rounded-full border-4 border-coral" aria-hidden />}
        <Svg size={34} stroke={2.6} fill={recording ? 'currentColor' : 'none'}>
          {recording ? Icon.stop : Icon.mic}
        </Svg>
      </button>
      <span className="text-sm font-bold text-sub">{label ?? (recording ? '다 말했으면 멈춤' : '누르고 말하기')}</span>
    </div>
  );
}

export function IssueBox({ issue, onRetry }: { issue: string; onRetry: () => void }) {
  const t = ISSUE_TEXT[issue] ?? ISSUE_TEXT.too_short;
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[22px] bg-white p-4 shadow-card">
      <b className="font-jua text-[22px] text-coral-ink">{t.title}</b>
      <ol className="flex flex-col gap-2 text-[15px]">
        {t.steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <Button onClick={onRetry}>다시 녹음하기</Button>
      <span className="text-center text-xs text-muted">괜찮아요, 바꿀 것 하나만 맞추면 돼요 · 이번 녹음은 횟수에 세지 않아요</span>
    </div>
  );
}

export function Analyzing({ target }: { target?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4" role="status" aria-live="polite">
      {target && <span className="font-jua text-[40px] text-brand">{target}</span>}
      <h2 className="text-center font-jua text-[22px]">내 소리를 정답과 비교하고 있어요...</h2>
      <div className="h-3 w-full overflow-hidden rounded-full bg-line">
        <div className="animate-bar h-full rounded-full bg-brand" />
      </div>
      <span className="rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">끝까지 말한 것부터 잘했어요!</span>
    </div>
  );
}

export function OfflineBox() {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-[22px] bg-white p-4 shadow-card">
      <b className="font-jua text-[22px]">인터넷 연결이 끊겼어요</b>
      <span className="text-[15px] leading-relaxed text-sub">녹음은 안전하게 보관해 뒀어요. 연결되면 바로 결과를 보여드릴게요. 다시 녹음할 필요는 없어요.</span>
      <a href="/offline" className="text-sm font-bold text-brand-dark">보관 중인 녹음 보기 ›</a>
    </div>
  );
}

/** 소리 모양: 바람은 주황, 목소리는 보라 (디자인 Landing · Record) */
export function SoundShape({ shape, label = '내 소리 모양' }: { shape: { kind: string; level: number }[]; label?: string }) {
  if (!shape?.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs font-bold">
        <span>{label}</span>
        <span className="flex items-center gap-2 text-muted">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-coral" />바람</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand" />목소리</span>
        </span>
      </div>
      <div className="flex h-12 items-center gap-[2px]" role="img" aria-label={`${label}: 바람 ${shape.filter((b) => b.kind === 'wind').length}칸, 목소리 ${shape.filter((b) => b.kind === 'voice').length}칸`}>
        {shape.map((b, i) => (
          <span key={i} className={b.kind === 'wind' ? 'w-full rounded-full bg-coral' : b.kind === 'voice' ? 'w-full rounded-full bg-brand' : 'w-full rounded-full bg-line'} style={{ height: `${Math.max(8, b.level * 100)}%` }} />
        ))}
      </div>
    </div>
  );
}
