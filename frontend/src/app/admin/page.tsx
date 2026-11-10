'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BackHeader, Button, Card, Chip, ErrorState, Loading, Sheet, cx } from '@/components/ui';
import { errorText } from '@/services/api';
import { adminApi } from '@/services/endpoints';
import { useAuth } from '@/stores/auth';

const KINDS = [
  ['', '전체'],
  ['SYLLABLE', '글자'],
  ['WORD', '단어'],
  ['SENTENCE', '문장'],
  ['PARAGRAPH', '문단'],
];
type Draft = { id?: string; kind: string; text: string; pronunciation: string; targetSounds: string; note: string; placement: boolean };
const EMPTY: Draft = { kind: 'WORD', text: '', pronunciation: '', targetSounds: '', note: '', placement: false };

/** 관리자 · 테스트 단어·문장 관리 (디자인에 화면이 없어 기존 톤으로 간단히) */
export default function AdminPage() {
  const role = useAuth((s) => s.user?.role);
  const qc = useQueryClient();
  const [q, setQ] = useState({ kind: '', status: '', search: '', sound: '' });
  const [tab, setTab] = useState<'items' | 'reports'>('items');
  const [edit, setEdit] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats, enabled: role === 'ADMIN' });
  const items = useQuery({ queryKey: ['admin-items', q], queryFn: () => adminApi.items(q), enabled: role === 'ADMIN' });
  const reports = useQuery({ queryKey: ['admin-reports'], queryFn: adminApi.reports, enabled: role === 'ADMIN' && tab === 'reports' });
  const refresh = () => (qc.invalidateQueries({ queryKey: ['admin-items'] }), qc.invalidateQueries({ queryKey: ['admin-stats'] }));
  const review = useMutation({ mutationFn: adminApi.review, onSuccess: refresh });
  const remove = useMutation({ mutationFn: adminApi.remove, onSuccess: refresh });

  if (role !== 'ADMIN') return <ErrorState message="관리자만 볼 수 있어요" />;

  const save = async () => {
    if (!edit) return;
    setErr(null);
    const body = { kind: edit.kind, text: edit.text.trim(), pronunciation: edit.pronunciation.trim() || edit.text.trim(), targetSounds: edit.targetSounds.split(/[\s,·]+/).filter(Boolean), note: edit.note || undefined, placement: edit.placement };
    try {
      if (edit.id) await adminApi.update(edit.id, body);
      else await adminApi.create(body);
      setEdit(null);
      refresh();
    } catch (e) {
      setErr(errorText(e));
    }
  };

  return (
    <main className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-[1080px] pb-10">
        <BackHeader title="관리자 · 단어와 문장" href="/settings" />
        {stats.data && (
          <div className="grid grid-cols-3 gap-2 px-5 pt-3 md:grid-cols-6">
            {[
              ['가입자', stats.data.users],
              ['손님', stats.data.guests],
              ['녹음 분석', stats.data.attempts],
              ['분석 실패', stats.data.failed],
              ['문항', stats.data.items],
              ['검토 전', stats.data.draft],
            ].map(([t, v]) => (
              <Card key={t as string} className="flex flex-col p-3">
                <span className="text-xs text-muted">{t}</span>
                <span className="font-jua text-[22px]">{v}</span>
              </Card>
            ))}
          </div>
        )}
        <div className="flex gap-2 px-5 pt-4">
          {(['items', 'reports'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cx('min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-bold', tab === t ? 'bg-ink text-white' : 'bg-white text-sub')}>
              {t === 'items' ? '문항' : '결과 이상 신고'}
            </button>
          ))}
          {tab === 'items' && (
            <Button className="ml-auto !h-11 !w-auto rounded-full px-5 !text-base" onClick={() => setEdit(EMPTY)}>
              + 새 문항
            </Button>
          )}
        </div>
        {tab === 'items' ? (
          <>
            <div className="flex flex-wrap gap-2 px-5 pt-3">
              <select aria-label="종류" value={q.kind} onChange={(e) => setQ({ ...q, kind: e.target.value })} className="min-h-[44px] rounded-xl bg-white px-3 text-sm">
                {KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <select aria-label="검토 상태" value={q.status} onChange={(e) => setQ({ ...q, status: e.target.value })} className="min-h-[44px] rounded-xl bg-white px-3 text-sm">
                <option value="">검토 전체</option>
                <option value="DRAFT">검토 전</option>
                <option value="REVIEWED">검토 완료</option>
              </select>
              <input aria-label="소리" placeholder="소리 (예: ㅅ)" value={q.sound} onChange={(e) => setQ({ ...q, sound: e.target.value.trim() })} className="min-h-[44px] w-32 rounded-xl bg-white px-3 text-sm" />
              <input aria-label="글자 검색" placeholder="글자 검색" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value })} className="min-h-[44px] flex-1 rounded-xl bg-white px-3 text-sm" />
            </div>
            {items.isLoading && <Loading />}
            {items.error && <ErrorState message={errorText(items.error)} onRetry={() => items.refetch()} />}
            <div className="overflow-x-auto px-5 pt-3">
              <table className="w-full min-w-[820px] border-separate border-spacing-y-1.5 whitespace-nowrap text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="w-[28%] px-3">글자</th>
                    <th className="w-[22%]">표준 발음</th>
                    <th>보는 소리</th>
                    <th>종류</th>
                    <th>상태</th>
                    <th>녹음</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.data?.map((it) => (
                    <tr key={it.id} className="bg-white">
                      <td className="max-w-[320px] truncate rounded-l-xl px-3 py-2.5 font-bold">
                        {it.text}
                        {it.placement && <Chip className="ml-1.5">진단</Chip>}
                      </td>
                      <td className="max-w-[260px] truncate text-sub">[{it.pronunciation}]</td>
                      <td>{it.targetSounds.join(' ')}</td>
                      <td className="text-sub">{KINDS.find(([v]) => v === it.kind)?.[1]}</td>
                      <td>{it.status === 'REVIEWED' ? <Chip tone="pass">검토 완료{it.reviewedBy ? ` · ${it.reviewedBy.name}` : ''}</Chip> : <Chip tone="coral">검토 전</Chip>}</td>
                      <td className="text-sub">{it._count.attempts}</td>
                      <td className="rounded-r-xl pr-3 text-right">
                        <span className="flex justify-end gap-1">
                          {it.status !== 'REVIEWED' && (
                            <button type="button" onClick={() => review.mutate(it.id)} className="min-h-[36px] rounded-lg bg-pass-soft px-2.5 text-xs font-bold text-pass-ink">
                              검토 승인
                            </button>
                          )}
                          <button type="button" onClick={() => setEdit({ id: it.id, kind: it.kind, text: it.text, pronunciation: it.pronunciation, targetSounds: it.targetSounds.join(' '), note: it.note ?? '', placement: it.placement })} className="min-h-[36px] rounded-lg bg-bg px-2.5 text-xs font-bold">
                            수정
                          </button>
                          <button type="button" onClick={() => confirm(`“${it.text}”을 지울까요?`) && remove.mutate(it.id)} className="min-h-[36px] rounded-lg bg-bg px-2.5 text-xs font-bold text-coral-ink">
                            삭제
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 px-5 pt-3">
            {reports.isLoading && <Loading />}
            {reports.data?.length === 0 && <p className="py-10 text-center text-sm text-muted">신고가 없어요</p>}
            {reports.data?.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3">
                <span className="flex flex-col text-sm">
                  <b>{r.reason}</b>
                  <span className="text-xs text-muted">
                    정답 {r.attempt.targetText} · 들린 대로 {r.attempt.heard ?? '—'} · {r.attempt.modelVersion ?? '모델 없음'}
                  </span>
                </span>
                {r.resolved ? <Chip tone="pass">확인함</Chip> : <button type="button" onClick={async () => (await adminApi.resolve(r.id), reports.refetch())} className="min-h-[40px] rounded-xl bg-bg px-3 text-xs font-bold">확인 완료</button>}
              </Card>
            ))}
          </div>
        )}
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} label="문항 편집">
        {edit && (
          <>
            <b className="font-jua text-[22px]">{edit.id ? '문항 수정' : '새 문항'}</b>
            <span className="text-xs text-muted">글자·발음·보는 소리를 바꾸면 다시 ‘검토 전’이 돼요.</span>
            <select aria-label="종류" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} className="min-h-[48px] rounded-xl border-2 border-line px-3">
              {KINDS.slice(1).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
            {(
              [
                ['text', '글자 (정답)'],
                ['pronunciation', '표준 발음 (예: 같이 → 가치) · 비우면 글자와 같게'],
                ['targetSounds', '보는 소리 (띄어서: ㅅ ㅆ)'],
                ['note', '메모 (예: ㅅ 첫소리)'],
              ] as const
            ).map(([k, t]) => (
              <label key={k} className="flex flex-col gap-1 text-sm font-bold">
                {t}
                <input value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className="min-h-[48px] rounded-xl border-2 border-line px-3 font-normal outline-none focus:border-brand" />
              </label>
            ))}
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input type="checkbox" className="h-5 w-5 accent-brand" checked={edit.placement} onChange={(e) => setEdit({ ...edit, placement: e.target.checked })} />첫 진단 문항
            </label>
            {err && <p role="alert" className="text-sm font-bold text-coral-ink">{err}</p>}
            <Button onClick={save} disabled={!edit.text.trim()}>
              저장
            </Button>
          </>
        )}
      </Sheet>
    </main>
  );
}
