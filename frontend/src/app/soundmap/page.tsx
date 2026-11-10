'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AppShell, Card, ErrorState, Loading, cx } from '@/components/ui';
import { errorText } from '@/services/api';
import { planApi } from '@/services/endpoints';
import type { SoundState } from '@/types/api';

// 디자인 SoundMap: 소리 나는 곳으로 나눈 자음
const PLACES = [
  { t: '입술소리', d: '두 입술을 붙였다 떼요', s: ['ㅂ', 'ㅃ', 'ㅍ', 'ㅁ'] },
  { t: '잇몸소리', d: '혀끝이 윗잇몸에 닿거나 가까이', s: ['ㄷ', 'ㄸ', 'ㅌ', 'ㅅ', 'ㅆ', 'ㄴ', 'ㄹ'] },
  { t: '센입천장소리', d: '혓바닥이 딱딱한 입천장에', s: ['ㅈ', 'ㅉ', 'ㅊ'] },
  { t: '여린입천장소리', d: '혀 뒤쪽이 말랑한 입천장에', s: ['ㄱ', 'ㄲ', 'ㅋ', 'ㅇ'] },
  { t: '목청소리', d: '목 깊은 곳에서 숨을 내쉬듯', s: ['ㅎ'] },
];
const VOWELS = { 모음: ['ㅣ', 'ㅏ', 'ㅜ', 'ㅓ', 'ㅗ', 'ㅡ', 'ㅔ', 'ㅐ', 'ㅚ', 'ㅟ'], 이중모음: ['ㅑ', 'ㅕ', 'ㅛ', 'ㅠ', 'ㅒ', 'ㅖ', 'ㅘ', 'ㅝ', 'ㅙ', 'ㅞ', 'ㅢ'] };
const TILE: Record<SoundState | 'CURRENT', string> = {
  ALREADY_GOOD: 'bg-pass text-white shadow-pass',
  LEARNED: 'bg-lime text-lime-ink shadow-[0_3px_0_#A6D46A]',
  CURRENT: 'bg-brand text-white shadow-[0_3px_0_#3F31D6]',
  LEARNING: 'bg-brand-soft text-brand-dark',
  LOCKED: 'bg-white text-ink shadow-chip',
};

/** 디자인: SoundMap · Vowels — 카드를 누르면 자세히 배워요 */
export default function SoundMapPage() {
  const [tab, setTab] = useState<'c' | 'v'>('c');
  const q = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  const state = (s: string): SoundState | 'CURRENT' => (q.data?.current?.symbol === s ? 'CURRENT' : q.data?.path.find((p) => p.symbol === s)?.state ?? 'LOCKED');
  const Tile = ({ s }: { s: string }) => (
    <Link href={`/learn/${encodeURIComponent(s)}`} aria-label={`${s} 배우기`} className={cx('flex h-14 w-14 items-center justify-center rounded-2xl font-jua text-[26px]', TILE[state(s)])}>
      {s}
    </Link>
  );
  return (
    <AppShell wide>
      <header className="flex flex-col gap-1 px-6 pt-[max(env(safe-area-inset-top),24px)] md:pt-6">
        <span className="text-[13px] font-bold text-brand-dark">소리 지도</span>
        <h1 className="font-jua text-[28px] lg:hidden">{tab === 'c' ? '소리 나는 곳' : '모음 입모양'}</h1>
        <h1 className="hidden font-jua text-[32px] lg:block">소리 배우기</h1>
        <p className="hidden text-sub lg:block">소리가 입 속 어디서, 어떻게 나는지 눈으로 봐요. 새 소리는 시작 전에 지금 소리를 3번 남겨요.</p>
        {q.data && (
          <ol className="mt-2 flex flex-wrap gap-1.5" aria-label="배우는 순서">
            {q.data.groups.map((g, i) => (
              <li key={g.key} className={cx('rounded-full px-3 py-1.5 text-xs font-bold', g.current ? 'bg-brand text-white' : g.done ? 'bg-pass-soft text-pass-ink' : 'bg-white text-muted shadow-chip')}>
                {i + 1} {g.label}
                {g.done ? ' ✓' : g.current ? ' · 지금' : ''}
              </li>
            ))}
          </ol>
        )}
        <div role="tablist" className="mt-2 flex gap-1 rounded-2xl bg-line p-1 lg:hidden">
          {[
            ['c', '자음 19'],
            ['v', '모음 21'],
          ].map(([k, t]) => (
            <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k as 'c' | 'v')} className={cx('h-10 flex-1 rounded-xl text-sm font-bold', tab === k ? 'bg-white text-ink' : 'text-muted')}>
              {t}
            </button>
          ))}
        </div>
      </header>
      {q.isLoading && <Loading />}
      {q.error && <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />}
      {q.data && (
        <div className="grid gap-3 px-5 pb-6 pt-4 lg:grid-cols-2">
          <div className={cx('flex-col gap-3', tab === 'c' ? 'flex' : 'hidden lg:flex')}>
          {PLACES.map((p) => (
                <Card key={p.t} className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="font-jua text-[20px] font-normal">{p.t}</b>
                    <span className="text-xs text-sub">{p.d}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">{p.s.map((s) => <Tile key={s} s={s} />)}</div>
                </Card>
              ))}
          </div>
          <div className={cx('flex-col gap-3', tab === 'v' ? 'flex' : 'hidden lg:flex')}>
            {Object.entries(VOWELS).map(([t, xs]) => (
                <Card key={t} className="flex flex-col gap-2.5">
                  <b className="font-jua text-[20px] font-normal">{t}</b>
                  <div className="flex flex-wrap gap-2">{xs.map((s) => <Tile key={s} s={s} />)}</div>
                </Card>
              ))}
            <Link href="/soundmap/vowels" className="rounded-2xl bg-white p-4 text-sm font-bold text-brand-dark shadow-chip">
              모음 10개 움직이는 입모양 보기 →
            </Link>
          </div>
          <div className="grid gap-2 md:grid-cols-3 lg:col-span-2">
            {[
              ['/smeter', 'ㅅ 쉬익 미터 →', '바람 높이를 kHz로 실시간 표시'],
              ['/soundmap/textures', '소리 모양 사전 →', '바람 · 터짐 · 울림을 움직임으로'],
              ['/voice', '억양 · 길이 →', '음높이 곡선 · 글자 길이 막대'],
            ].map(([h, t, d]) => (
              <Link key={h} href={h} className="flex flex-col gap-0.5 rounded-2xl bg-white p-4 shadow-chip">
                <b className="text-sm">{t}</b>
                <span className="text-xs text-muted">{d}</span>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 px-1 text-xs text-sub lg:col-span-2">
            {[
              ['bg-pass', '이미 좋아요'],
              ['bg-lime', '배웠어요'],
              ['bg-brand', '지금 배우는 중'],
              ['bg-white border border-line2', '아직이에요'],
            ].map(([c, t]) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className={cx('h-3 w-3 rounded', c)} />
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
