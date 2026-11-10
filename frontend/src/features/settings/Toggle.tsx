'use client';
import { cx } from '@/components/ui';

export function Toggle({ on, onChange, label, desc, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string; disabled?: boolean }) {
  return (
    <label className={cx('flex min-h-[52px] items-center justify-between gap-3', disabled && 'opacity-50')}>
      <span className="flex flex-col">
        <span className="text-[15px] font-bold">{label}</span>
        {desc && <span className="text-xs text-muted">{desc}</span>}
      </span>
      <input type="checkbox" role="switch" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className={cx('relative h-8 w-14 shrink-0 rounded-full transition-colors peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-brand', on ? 'bg-brand' : 'bg-line2')}>
        <span className={cx('absolute top-1 h-6 w-6 rounded-full bg-white transition-all', on ? 'left-7' : 'left-1')} />
      </span>
    </label>
  );
}

export const RETENTION = [
  { v: 30, t: '30일' },
  { v: 90, t: '90일' },
  { v: 365, t: '1년' },
  { v: 0, t: '내가 지울 때까지' },
];

export function RetentionPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <b className="text-sm">녹음 원본 보관</b>
      <div role="radiogroup" className="grid grid-cols-4 gap-1.5">
        {RETENTION.map((r) => (
          <button key={r.v} type="button" role="radio" aria-checked={value === r.v} onClick={() => onChange(r.v)} className={cx('min-h-[44px] rounded-xl px-1 text-xs font-bold', value === r.v ? 'bg-ink text-white' : 'bg-bg text-sub')}>
            {r.t}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-muted">기간이 지나면 원본 소리만 지우고, 결과 글자와 측정값은 남아요.</span>
    </div>
  );
}
