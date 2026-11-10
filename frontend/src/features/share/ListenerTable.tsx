'use client';
import { cx } from '@/components/ui';

export const GROUPS = [
  { v: 'FAMILY', t: '가족' },
  { v: 'FRIEND', t: '친구' },
  { v: 'TEACHER', t: '선생님 · 치료사' },
  { v: 'STRANGER', t: '처음 듣는 사람' },
];
export const FAM: Record<string, string> = { FIRST: '처음 듣는 사람', SOMETIMES: '가끔 들어봄', OFTEN: '자주 들어봄' };
const norm = (s: string | null | undefined) => (s ?? '').replace(/[\s.?!,]/g, '');

export interface MyLink {
  id: string;
  code: string;
  group: string;
  createdAt: string;
  expiresAt: string;
  active: boolean;
  listeners: number;
  agreement: { agree: number; total: number };
  byListener: { familiarity: string; understood: number; total: number }[];
  items: { order: number; target: string; app: { heard: string | null; matched: number | null; total: number | null }; answers: { text: string | null; unsure: boolean; familiarity: string; matched: number | null; total: number | null }[] }[];
}

/** 가장 많이 나온 사람 답 */
const topAnswer = (ans: MyLink['items'][number]['answers']) => {
  const c = new Map<string, number>();
  for (const a of ans) if (!a.unsure && a.text) c.set(a.text, (c.get(a.text) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (ans.length ? '잘 모르겠어요' : null);
};

/** 디자인: ListenerResult · 말하려던 것 / 사람이 적은 것 / 앱이 들은 것 */
export function ListenerTable({ link }: { link: MyLink }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="pb-2">말하려던 것</th>
              <th className="pb-2">사람이 적은 것</th>
              <th className="pb-2">앱이 들은 것</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {link.items.map((i) => {
              const human = topAnswer(i.answers);
              const agree = human && i.app.heard ? norm(human) === norm(i.app.heard) : null;
              const humanOk = human ? norm(human) === norm(i.target) : null;
              const appWrong = humanOk && agree === false;
              return (
                <tr key={i.order} className="border-t-2 border-line">
                  <td className="py-2.5 font-bold">{i.target}</td>
                  <td className={cx(humanOk ? 'text-pass-text' : 'text-ink')}>{human ?? <span className="text-muted">아직 없음</span>}</td>
                  <td>{i.app.heard ?? '—'}</td>
                  <td className="whitespace-nowrap text-xs font-bold">{agree === null ? '' : agree ? <span className="text-pass-text">같음</span> : <span className="text-coral-ink">{appWrong ? '앱이 틀림' : '다름'}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {link.byListener.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <b className="text-xs text-sub">듣는 사람별</b>
          {link.byListener.map((b, k) => (
            <div key={k} className="flex justify-between rounded-xl bg-bg px-3 py-2 text-sm">
              <span>{FAM[b.familiarity] ?? b.familiarity}</span>
              <span>
                {b.total}개 중 <b>{b.understood}개</b> 알아들음
              </span>
            </div>
          ))}
        </div>
      )}
      <span className="text-xs leading-relaxed text-muted">사람이 알아들었는데 앱이 다르게 들었다면 앱이 틀린 걸로 기록해요. 이 결과로 앱 판정을 계속 고쳐요.</span>
    </div>
  );
}
