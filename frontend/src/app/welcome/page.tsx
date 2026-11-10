'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Mascot, cx } from '@/components/ui';

/** 디자인: Splash · 로고 1초 → Welcome · 첫 실행 소개 */
export default function WelcomePage() {
  const [splash, setSplash] = useState(true);
  const [poke, setPoke] = useState(0);
  useEffect(() => {
    if (sessionStorage.getItem('malang-splash')) return setSplash(false);
    const t = setTimeout(() => (setSplash(false), sessionStorage.setItem('malang-splash', '1')), 1400);
    return () => clearTimeout(t);
  }, []);

  if (splash)
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 bg-brand text-white" onClick={() => setPoke((p) => p + 1)}>
        <button type="button" aria-label="말랑이 누르기" key={poke} className="mallang animate-[squish_0.5s_ease]">
          <svg width="140" height="118" viewBox="0 0 100 84" aria-hidden>
            <path d="M50 8 C 78 8, 94 30, 94 52 C 94 70, 76 78, 50 78 C 36 78, 26 76, 18 72 L 7 80 L 11 66 C 7 62, 6 58, 6 52 C 6 30, 22 8, 50 8 Z" fill="#FFFFFF" />
            <ellipse cx="38" cy="43" rx="5" ry="6" fill="#1B1A33" />
            <ellipse cx="62" cy="43" rx="5" ry="6" fill="#1B1A33" />
            <path d="M44 53 Q 50 59, 56 53" fill="none" stroke="#1B1A33" strokeWidth="2.6" strokeLinecap="round" />
            <ellipse cx="28" cy="55" rx="6.5" ry="3.6" fill="#FF8AA0" />
            <ellipse cx="72" cy="55" rx="6.5" ry="3.6" fill="#FF8AA0" />
          </svg>
        </button>
        <span className="flex gap-1 font-jua text-[44px]" aria-label="말랑말랑">
          {'말랑말랑'.split('').map((c, i) => (
            <span key={i} className="inline-block animate-[bob_1s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.12}s` }} aria-hidden>
              {c}
            </span>
          ))}
        </span>
        <span className="text-sm font-bold tracking-wide text-brand-light">ship and giggle</span>
        <span className="mt-6 text-xs text-brand-light">말랑이를 콕 눌러보세요</span>
      </main>
    );

  const points = ['4분 진단으로 아는 소리는 건너뛰어요', '그림으로 혀와 입술 위치를 배워요', '말하면 실제로 낸 소리를 보여줘요'];
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-bg px-7 pb-8 pt-16">
      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <button type="button" aria-label="말랑이 누르기" key={poke} onClick={() => setPoke((p) => p + 1)} className={cx(poke > 0 && 'animate-[squish_0.5s_ease]')}>
            <Mascot size={120} />
          </button>
          <span className="font-jua text-[40px] tracking-[0.2em] text-brand">말랑말랑</span>
          <span className="text-sm font-bold tracking-wide text-faint">ship and giggle</span>
        </div>
        <h1 className="text-center font-jua text-[28px] leading-snug">
          들리지 않아도,
          <br />내 말소리를 눈으로 봐요
        </h1>
        <ol className="flex flex-col gap-2.5">
          {points.map((p, i) => (
            <li key={p} className="flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 shadow-chip">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-jua text-brand-dark">{i + 1}</span>
              <span className="text-[15px]">{p}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-2 pt-6">
        <Button href="/tutorial">시작하기</Button>
        <Link href="/login/id" className="flex min-h-[44px] items-center justify-center text-sm font-bold text-brand-dark">
          이미 계정이 있어요 · 로그인
        </Link>
      </div>
    </main>
  );
}
