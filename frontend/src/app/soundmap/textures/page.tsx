'use client';
import { useEffect, useState } from 'react';
import { AppShell, BackHeader, Card, cx } from '@/components/ui';

/** 진동 모양: ━ 길게 · ● 세게 한 번 · ■ 단단하게 · ∿ 부드럽게 웅웅 */
const TEXTURES = [
  { name: '새는 바람', sounds: 'ㅅ ㅆ ㅎ', sym: '━━━━━', desc: '좁은 틈으로 바람이 계속 새어 나와요. 쉬익—', pattern: [900] },
  { name: '톡 터짐', sounds: 'ㄱ ㄷ ㅂ', sym: '●', desc: '막았다가 살짝 톡. 바람은 거의 없어요.', pattern: [40] },
  { name: '거센 터짐', sounds: 'ㅋ ㅌ ㅍ ㅊ', sym: '●━━', desc: '막았다가 팍! 바람 뭉치가 세게 나와요. 손바닥에 확 느껴져요.', pattern: [80, 20, 300] },
  { name: '꽉 된소리', sounds: 'ㄲ ㄸ ㅃ ㅆ ㅉ', sym: '■', desc: '목과 입에 힘을 꽉 주고 짧고 단단하게. 바람은 거의 안 나와요.', pattern: [120] },
  { name: '막았다 새기', sounds: 'ㅈ ㅊ ㅉ', sym: '●━', desc: '혓바닥으로 막았다가 톡 터지며 바람이 조금 새요.', pattern: [50, 20, 160] },
  { name: '코 울림', sounds: 'ㅁ ㄴ ㅇ', sym: '∿∿∿', desc: '입은 막고 코로 울려요. 콧등에 손가락을 대면 웅웅 떨려요.', pattern: [60, 40, 60, 40, 60, 40, 60, 40, 60] },
  { name: '혀 튕기기', sounds: 'ㄹ', sym: '·', desc: '혀끝이 윗잇몸을 가볍게 한 번 톡 치고 내려와요.', pattern: [15] },
  { name: '목소리 모음', sounds: 'ㅏ ㅓ ㅗ …', sym: '≈≈≈≈', desc: '목청이 고르게 떨려요. 목에 손을 대면 계속 떨림이 느껴져요.', pattern: [30, 15, 30, 15, 30, 15, 30, 15, 30, 15, 30, 15, 30] },
];

/** 디자인: SoundTextures · 소리 모양 사전 (진동으로 느끼기) */
export default function TexturesPage() {
  const [canVibrate, setCanVibrate] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => setCanVibrate(typeof navigator !== 'undefined' && 'vibrate' in navigator), []);
  const play = (t: (typeof TEXTURES)[number]) => {
    setPlaying(t.name);
    if (canVibrate) navigator.vibrate(t.pattern);
    setTimeout(() => setPlaying(null), t.pattern.reduce((a, b) => a + b, 0) + 150);
  };
  return (
    <AppShell>
      <BackHeader title="소리 지도 · 소리 모양" href="/soundmap" />
      <div className="flex flex-col gap-1 px-6 pt-2">
        <h1 className="font-jua text-[28px]">소리 모양 사전</h1>
        <p className="text-sm text-sub">소리는 내는 방법마다 모양이 달라요. 움직임과 진동으로 느껴봐요.</p>
      </div>
      <div className="grid gap-2.5 px-5 pb-6 pt-4 md:grid-cols-2">
        {TEXTURES.map((t) => (
          <button key={t.name} type="button" onClick={() => play(t)} className="text-left">
            <Card className={cx('flex items-center gap-3 transition-transform', playing === t.name && 'scale-[0.98] ring-2 ring-brand')}>
              <div className="flex flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <b className="text-[16px]">{t.name}</b>
                  <span className="font-jua text-brand-dark">{t.sounds}</span>
                </span>
                <span className="text-sm leading-relaxed text-sub">{t.desc}</span>
              </div>
              <span aria-hidden className={cx('shrink-0 font-jua text-xl text-coral', playing === t.name && 'animate-pulse')}>
                {t.sym}
              </span>
            </Card>
          </button>
        ))}
      </div>
      <p className="px-6 pb-8 text-xs leading-relaxed text-muted">
        오른쪽 기호는 진동 모양이에요. ━ 길게 · ● 세게 한 번 · ■ 단단하게 · ∿ 부드럽게 웅웅
        {canVibrate === false && ' · 이 기기(브라우저)는 진동을 지원하지 않아서 기호만 움직여요.'}
      </p>
    </AppShell>
  );
}
