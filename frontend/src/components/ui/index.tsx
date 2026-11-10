'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { planApi } from '@/services/endpoints';
import type { ComponentProps, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ── 아이콘 (디자인과 같은 선 아이콘) ───────────────────────── */
export const Icon = {
  back: <path d="M15 5l-7 7 7 7" />,
  home: (
    <>
      <path d="M4 19V9l8-5 8 5v10" />
      <path d="M9 19v-6h6v6" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  wave: <path d="M3 12h3l3-7 4 14 3-7h5" />,
  me: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  check: <path d="M5 12l5 5 9-10" />,
  play: <path d="M8 5v14l11-7z" />,
  next: <path d="M9 5l7 7-7 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
};

export function Svg({ children, size = 22, stroke = 2.4, className, fill = 'none' }: { children: ReactNode; size?: number; stroke?: number; className?: string; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

/* ── 말랑이 (디자인 캐릭터) ─────────────────────────────── */
export function Mascot({ size = 96, mood = 'smile', className }: { size?: number; mood?: 'smile' | 'happy' | 'calm'; className?: string }) {
  return (
    <svg width={size} height={(size * 84) / 100} viewBox="0 0 100 84" aria-hidden="true" className={className}>
      <path d="M50 8 C 78 8, 94 30, 94 52 C 94 70, 76 78, 50 78 C 36 78, 26 76, 18 72 L 7 80 L 11 66 C 7 62, 6 58, 6 52 C 6 30, 22 8, 50 8 Z" fill="#5B4BFF" />
      <path d="M14 58 C 20 72, 40 76, 60 76 C 76 76, 88 70, 92 58 C 88 72, 72 79, 50 79 C 30 79, 18 72, 14 58 Z" fill="#4A3BE8" />
      <ellipse cx="36" cy="22" rx="14" ry="6" fill="#FFFFFF" opacity="0.3" transform="rotate(-18 36 22)" />
      {mood === 'happy' ? (
        <>
          <path d="M33 44 Q 38 38, 43 44 M57 44 Q 62 38, 67 44" fill="none" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M43 51 Q 50 61, 57 51 Z" fill="#1B1A33" />
        </>
      ) : (
        <>
          <ellipse cx="38" cy="43" rx="5" ry="6" fill="#FFFFFF" />
          <ellipse cx="62" cy="43" rx="5" ry="6" fill="#FFFFFF" />
          <ellipse cx="39" cy="44" rx="3" ry="3.8" fill="#1B1A33" />
          <ellipse cx="63" cy="44" rx="3" ry="3.8" fill="#1B1A33" />
          <circle cx="40" cy="42.5" r="1.1" fill="#FFFFFF" />
          <circle cx="64" cy="42.5" r="1.1" fill="#FFFFFF" />
          <path d={mood === 'calm' ? 'M45 54 L 55 54' : 'M44 53 Q 50 59, 56 53'} fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
        </>
      )}
      <ellipse cx="28" cy="55" rx="6.5" ry="3.6" fill="#FF8AA0" />
      <ellipse cx="72" cy="55" rx="6.5" ry="3.6" fill="#FF8AA0" />
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-1.5 font-jua" style={{ fontSize: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="" width={34} height={27} />
      말랑말랑
    </span>
  );
}

/* ── 버튼 ─────────────────────────────────────────────── */
type BtnVariant = 'primary' | 'dark' | 'outline' | 'ghost' | 'pass' | 'kakao' | 'google';
const BTN: Record<BtnVariant, string> = {
  primary: 'h-[58px] rounded-[18px] bg-brand text-white shadow-btn font-jua text-[20px] active:translate-y-[3px] active:shadow-none disabled:bg-line2 disabled:shadow-none disabled:text-white',
  dark: 'h-14 rounded-[14px] bg-ink text-white text-base font-bold',
  outline: 'h-[54px] rounded-2xl border-2 border-line text-sub text-[15px] font-bold bg-white',
  ghost: 'min-h-[44px] text-brand-dark text-sm font-bold',
  pass: 'h-[58px] rounded-[18px] bg-pass text-white shadow-[0_5px_0_#0E7A53] font-jua text-[20px]',
  kakao: 'relative h-14 rounded-[14px] bg-kakao text-[#191919] text-base font-bold',
  google: 'relative h-14 rounded-[14px] bg-white border-[1.5px] border-[#DADCE0] text-[#1F1F1F] text-base font-bold',
};
export function Button({ variant = 'primary', className, href, children, ...rest }: ComponentProps<'button'> & { variant?: BtnVariant; href?: string }) {
  // className 에 너비(w-…)를 주면 기본 w-full 대신 그 값을 쓴다 (Tailwind 클래스 순서 충돌 방지)
  const cls = cx('flex items-center justify-center gap-2 transition-transform select-none disabled:cursor-not-allowed', /(^|\s)w-/.test(className ?? '') ? '' : 'w-full', BTN[variant], className);
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

/* ── 머리 · 진행 막대 ─────────────────────────────────── */
export function BackHeader({ title, progress, right, href }: { title?: ReactNode; progress?: number; right?: ReactNode; href?: string }) {
  const router = useRouter();
  return (
    <header className="flex items-center gap-2 pl-3 pr-5 pt-[max(env(safe-area-inset-top),20px)] md:pt-6">
      <button type="button" aria-label="뒤로" onClick={() => (href ? router.push(href) : router.back())} className="flex h-11 w-11 shrink-0 items-center justify-center text-muted">
        <Svg stroke={2.6}>{Icon.back}</Svg>
      </button>
      {progress !== undefined ? (
        <div className="h-3.5 flex-grow overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-brand shadow-[inset_0_-4px_0_#3F31D6] transition-all" style={{ width: `${Math.max(4, progress * 100)}%` }} />
        </div>
      ) : (
        <span className="flex-grow text-sm font-bold text-brand-dark">{title}</span>
      )}
      {right}
    </header>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<'section'>) {
  return (
    <section className={cx('rounded-[22px] bg-white p-4 shadow-card', className)} {...rest}>
      {children}
    </section>
  );
}

export function Chip({ tone = 'brand', children, className }: { tone?: 'brand' | 'pass' | 'coral' | 'muted'; children: ReactNode; className?: string }) {
  const t = { brand: 'bg-brand-soft text-brand-dark', pass: 'bg-pass-soft text-pass-ink', coral: 'bg-coral-soft text-coral-ink', muted: 'bg-bg text-sub' }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', t, className)}>{children}</span>;
}

/* ── 화면 상태 (Loading · Error · Empty) ───────────────── */
export function Loading({ text = '불러오는 중이에요' }: { text?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16" role="status" aria-live="polite">
      <Mascot size={80} className="animate-bob" />
      <span className="text-sm text-muted">{text}</span>
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center" role="alert">
      <Mascot size={80} mood="calm" />
      <p className="font-jua text-[22px] leading-snug">{message}</p>
      {onRetry && (
        <Button variant="outline" className="max-w-[220px]" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}
export function Empty({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-16 text-center">
      <Mascot size={80} />
      <p className="font-jua text-[22px]">{title}</p>
      {desc && <p className="text-sm leading-relaxed text-sub">{desc}</p>}
      {action}
    </div>
  );
}

/* ── 앱 틀: 휴대폰은 하단 메뉴 4개, 넓은 화면은 왼쪽 메뉴 7개 (디자인 WebHome) ───── */
const NAV = [
  { href: '/home', label: '학습', icon: Icon.home },
  { href: '/soundmap', label: '소리 지도', icon: Icon.grid },
  { href: '/records', label: '내 녹음', icon: Icon.wave },
  { href: '/settings', label: '나', icon: Icon.me },
];
const WEB_NAV = [
  { href: '/home', label: '학습', icon: Icon.home },
  { href: '/soundmap', label: '소리 배우기', icon: Icon.grid },
  { href: '/voice', label: '발성 · 억양', icon: Icon.wave },
  { href: '/script', label: '내 글로 연습', icon: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" /> },
  { href: '/progress', label: '성장 기록', icon: <path d="M4 20h16M7 16v-4M12 16V8M17 16v-6" /> },
  { href: '/share', label: '사람 귀 확인', icon: <path d="M8 18a6 6 0 1 1 8-6c0 3-3 3-3 6a2 2 0 0 1-4 0" /> },
  { href: '/settings', label: '설정', icon: Icon.me },
];

export function AppShell({ children, nav = true, tabs, wide = false, strip }: { children: ReactNode; nav?: boolean; tabs?: boolean; wide?: boolean; strip?: ReactNode }) {
  const path = usePathname();
  const showTabs = tabs ?? nav;
  return (
    <div className="min-h-dvh bg-bg lg:flex">
      {nav && (
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r-2 border-line bg-white px-4 py-6 lg:flex">
          <Link href="/home" className="mb-6 px-2">
            <Logo />
          </Link>
          {WEB_NAV.map((n) => {
            const on = path === n.href || path.startsWith(n.href + '/') || (n.href === '/soundmap' && path.startsWith('/learn')) || (n.href === '/progress' && path.startsWith('/records'));
            return (
              <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined} className={cx('flex min-h-[48px] items-center gap-3 rounded-2xl px-3 text-[15px]', on ? 'bg-brand-soft font-bold text-brand-dark' : 'text-muted hover:bg-bg')}>
                <Svg stroke={2.2}>{n.icon}</Svg>
                {n.label}
              </Link>
            );
          })}
          <div className="mt-auto px-2 text-xs leading-relaxed text-faint">휴대폰 앱과 학습 기록이 이어져요.</div>
        </aside>
      )}
      <div className={cx('mx-auto flex min-h-dvh w-full flex-col', wide ? 'max-w-[480px] md:max-w-[760px] lg:max-w-[1180px] lg:px-8' : 'max-w-[480px] md:max-w-[640px] lg:max-w-[760px]', 'lg:py-4')}>
        {nav && <div className="hidden justify-end pt-2 lg:flex">{strip ?? <TodayStrip />}</div>}
        <main className="flex flex-1 flex-col">{children}</main>
        {showTabs && (
          <nav aria-label="주요 메뉴" className="sticky bottom-0 z-10 grid grid-cols-4 border-t-2 border-line bg-white px-2.5 pb-[max(env(safe-area-inset-bottom),16px)] pt-2 lg:hidden">
            {NAV.map((n) => {
              const on = path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined} className={cx('flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-xs', on ? 'font-bold text-brand-dark' : 'font-medium text-muted')}>
                  <span className={cx('flex h-8 w-12 items-center justify-center rounded-xl', on && 'bg-brand-soft')}>
                    <Svg stroke={2.2}>{n.icon}</Svg>
                  </span>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}

/** 넓은 화면 위쪽 띠: 오늘 3/5 · 2개만 더 하면 끝! */
function TodayStrip() {
  const q = useQuery({ queryKey: ['plan'], queryFn: planApi.today, staleTime: 30_000 });
  if (!q.data) return null;
  const left = Math.max(0, q.data.goal - q.data.completed);
  return (
    <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-dark shadow-chip">
      오늘 {q.data.completed}/{q.data.goal} · {left === 0 ? '오늘 목표 달성!' : left <= 2 ? `${left}개만 더 하면 끝!` : `${left}개 남았어요`}
    </span>
  );
}

/** 아래에서 올라오는 시트 (일기, 도움, 나가기 확인) */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-[rgba(27,26,51,0.55)]" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={label} className="relative flex w-full max-w-[480px] flex-col gap-3.5 rounded-t-[32px] bg-white px-[22px] pb-8 pt-3 md:rounded-[32px]">
        <span aria-hidden className="h-[5px] w-10 self-center rounded bg-line" />
        {children}
      </section>
    </div>
  );
}

export { cx };
