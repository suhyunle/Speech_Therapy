import { cx } from '@/components/ui';
import { diffChars } from '@/utils/hangul';

/** 들린 대로 · 보정 없이. 정답과 다르게 들린 글자는 주황 */
export function Heard({ target, heard, className }: { target: string; heard: string | null; className?: string }) {
  if (!heard) return <span className={cx('text-muted', className)}>들린 소리가 없어요</span>;
  return (
    <span className={className}>
      {diffChars(target, heard).map((c, i) => (
        <span key={i} className={c.wrong ? 'rounded-md bg-coral px-0.5 text-ink' : undefined}>
          {c.ch}
        </span>
      ))}
    </span>
  );
}
