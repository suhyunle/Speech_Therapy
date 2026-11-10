'use client';
/** ㅅ 쉬익 미터 · 바람 소리 중심 높이(kHz). 0~10, ㅅ 목표 6~8.5. 기기에서 바로 계산한 값 */
export function HissKHzMeter({ khz, strength, listening }: { khz: number | null; strength: number; listening: boolean }) {
  const pos = khz == null ? null : Math.max(0, Math.min(10, khz)) / 10;
  const inTarget = khz != null && khz >= 6 && khz <= 8.5;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs font-bold">
        <span>바람 소리 중심 높이 (kHz)</span>
        <span className={listening ? 'text-coral-ink' : 'text-muted'}>{listening ? '● 듣고 있어요' : '멈춤'}</span>
      </div>
      <div className="relative h-10 rounded-2xl bg-line">
        <span className="absolute inset-y-0 rounded-xl bg-pass-range" style={{ left: '60%', width: '25%' }} />
        <span className="absolute -top-5 text-[11px] font-bold text-pass-text" style={{ left: '60%' }}>
          ㅅ 목표 6~8.5
        </span>
        {pos != null && strength > 0.15 && (
          <span className={`absolute top-1.5 h-7 w-7 -translate-x-1/2 rounded-full border-4 border-white shadow transition-[left] ${inTarget ? 'bg-pass' : 'bg-coral'}`} style={{ left: `${pos * 100}%` }} />
        )}
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        {[0, 2, 4, 6, 8, 10].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>낮음 · ‘쉬’ 쪽</span>
        <span>높음 · ‘스’ 쪽</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="w-16 shrink-0 font-bold">높은 바람 세기</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-coral transition-all" style={{ width: `${Math.min(100, strength * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
