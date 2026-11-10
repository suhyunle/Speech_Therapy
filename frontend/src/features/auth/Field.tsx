'use client';
import { useId, type ReactNode } from 'react';
import { cx } from '@/components/ui';

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  hintTone,
  invalid,
  autoComplete,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: ReactNode;
  hintTone?: 'ok' | 'bad' | 'muted';
  invalid?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric';
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        aria-invalid={invalid || hintTone === 'bad'}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cx(
          'h-14 rounded-2xl border-2 bg-white px-4 text-base outline-none focus:border-brand',
          invalid || hintTone === 'bad' ? 'border-coral' : hintTone === 'ok' ? 'border-pass' : 'border-line',
        )}
      />
      {hint && (
        <span id={`${id}-hint`} className={cx('text-[13px] font-bold', hintTone === 'ok' ? 'text-pass-text' : hintTone === 'bad' ? 'text-coral-ink' : 'text-muted')}>
          {hint}
        </span>
      )}
    </div>
  );
}
