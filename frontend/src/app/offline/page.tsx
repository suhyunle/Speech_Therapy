'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AppShell, Button, Card, Mascot, cx } from '@/components/ui';
import { attemptsApi } from '@/services/endpoints';
import { notifyQueueChanged, offlineQueue, type PendingAttempt } from '@/utils/offline';

type Row = PendingAttempt & { status?: string; passed?: boolean | null };

/** 디자인: Offline · 녹음은 안전하게 보관해 뒀어요 */
export default function OfflinePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [online, setOnline] = useState(true);
  const [checking, setChecking] = useState(false);
  const load = useCallback(async () => {
    const list = await offlineQueue.list().catch(() => [] as PendingAttempt[]);
    const out: Row[] = [];
    for (const p of list.sort((a, b) => a.createdAt - b.createdAt)) {
      if (!p.attemptId || !navigator.onLine) {
        out.push(p);
        continue;
      }
      try {
        const a = await attemptsApi.get(p.attemptId);
        out.push({ ...p, status: a.status, passed: a.passed });
      } catch {
        out.push(p);
      }
    }
    setRows(out);
  }, []);
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => (setOnline(true), void load());
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('malang-offline', load);
    void load();
    const iv = setInterval(load, 5000);
    return () => (window.removeEventListener('online', on), window.removeEventListener('offline', off), window.removeEventListener('malang-offline', load), clearInterval(iv));
  }, [load]);
  const waiting = rows.filter((r) => !r.attemptId);
  const retry = async () => {
    setChecking(true);
    setOnline(navigator.onLine);
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 1200));
    await load();
    setChecking(false);
  };
  const clearDone = async () => {
    for (const r of rows) if (r.attemptId && r.status && ['DONE', 'ISSUE', 'FAILED'].includes(r.status)) await offlineQueue.remove(r.clientId);
    notifyQueueChanged();
    void load();
  };
  return (
    <AppShell tabs={false}>
      <div className="flex flex-col items-center gap-3 px-6 pt-14 text-center">
        <Mascot size={96} mood="calm" />
        <span className="text-sm font-bold text-brand-dark">{online ? '연결됐어요' : '인터넷 연결이 끊겼어요'}</span>
        <h1 className="font-jua text-[28px] leading-tight">
          녹음은 안전하게
          <br />
          보관해 뒀어요
        </h1>
        <p className="text-sm leading-relaxed text-sub">연결되면 바로 결과를 보여드릴게요. 녹음을 다시 할 필요는 없어요.</p>
      </div>
      <div className="flex flex-col gap-2 px-5 pt-5">
        <b className="text-sm">{waiting.length ? `결과 기다리는 중 ${waiting.length}개` : rows.length ? '올린 녹음' : '보관 중인 녹음이 없어요'}</b>
        {rows.map((r) => {
          const done = r.status === 'DONE' || r.status === 'ISSUE';
          return (
            <Card key={r.clientId} className="flex items-center justify-between py-3">
              <span className="flex flex-col">
                <b>{r.targetText || '녹음'}</b>
                <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </span>
              {done && r.attemptId ? (
                <Link href={`/result/${r.attemptId}`} className={cx('rounded-full px-3 py-1.5 text-xs font-bold', r.status === 'ISSUE' ? 'bg-coral-soft text-coral-ink' : 'bg-pass-soft text-pass-ink')}>
                  {r.status === 'ISSUE' ? '다시 녹음 필요' : '결과 보기'} ›
                </Link>
              ) : (
                <span className="text-xs font-bold text-muted">{r.attemptId ? (r.status === 'FAILED' ? '분석 실패' : '분석 중') : '연결 기다리는 중'}</span>
              )}
            </Card>
          );
        })}
        {rows.some((r) => r.attemptId && r.status) && (
          <button type="button" onClick={clearDone} className="self-end text-xs font-bold text-muted">
            끝난 것 목록에서 지우기
          </button>
        )}
        <p className="pt-2 text-xs leading-relaxed text-muted">
          인터넷 없이도 <b>소리 배우기</b>와 <b>소리 지도</b>는 볼 수 있어요. (한 번 열어 본 화면만)
        </p>
      </div>
      <div className="mt-auto flex flex-col gap-2 px-5 pb-8 pt-5">
        <Button onClick={retry} disabled={checking}>
          {checking ? '확인하는 중…' : '다시 연결해 보기'}
        </Button>
        <Button variant="ghost" href="/soundmap">
          그동안 소리 배우기
        </Button>
      </div>
    </AppShell>
  );
}
