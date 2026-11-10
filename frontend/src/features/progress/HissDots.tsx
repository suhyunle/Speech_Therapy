'use client';
/** ㅅ · 기초선 vs 연습 후 바람 중심 높이(kHz) 점 그림 */
export function HissDots({ baseline, after }: { baseline: number[]; after: number[] }) {
  const Row = ({ label, xs, c }: { label: string; xs: number[]; c: string }) => (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-sub">{label}</span>
      <div className="relative h-8 rounded-xl bg-bg">
        <span className="absolute inset-y-0 rounded-lg bg-pass-range" style={{ left: '60%', width: '25%' }} />
        {xs.map((v, i) => (
          <span key={i} className={`absolute top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-white ${c}`} style={{ left: `${Math.min(98, Math.max(2, (v / 10) * 100))}%` }} title={`${v} kHz`} />
        ))}
        {!xs.length && <span className="absolute inset-0 flex items-center justify-center text-[11px] text-muted">아직 없어요</span>}
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-2">
      <Row label={`기초선 ${baseline.length}회 (연습 전)`} xs={baseline} c="bg-faint" />
      <Row label={`연습 후 ${after.length}회 · 같은 단어`} xs={after} c="bg-brand" />
      <div className="flex justify-between text-[11px] text-muted">
        <span>0</span>
        <span>ㅅ 목표 6~8.5 kHz</span>
        <span>10</span>
      </div>
    </div>
  );
}
