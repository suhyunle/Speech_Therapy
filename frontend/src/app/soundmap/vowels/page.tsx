'use client';
import { AppShell, BackHeader, Button, Card, cx } from '@/components/ui';
import { Mouth, VOWEL_LIST, useMouthClock } from '@/features/vowels/Mouth';
import { useQuery } from '@tanstack/react-query';
import { planApi } from '@/services/endpoints';

const GROUPS = [
  { label: '크게 벌리기', ks: ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ'] },
  { label: '동그랗게', ks: ['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ'] },
  { label: '옆으로', ks: ['ㅡ', 'ㅣ'] },
];

/** 디자인: Vowels · 모음 입모양 10 */
export default function VowelsPage() {
  const clock = useMouthClock();
  const plan = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  const curVowel = plan.data?.path.find((p) => p.state === 'LEARNING' && p.kind === 'VOWEL')?.symbol ?? plan.data?.path.find((p) => p.kind === 'VOWEL' && p.state === 'LOCKED')?.symbol;
  return (
    <AppShell wide>
      <BackHeader title="소리 지도 · 모음" href="/soundmap" right={<button type="button" onClick={clock.toggle} className="min-h-[44px] px-2 text-xs font-bold text-brand-dark">{clock.on ? '움직임 멈추기' : '움직이기'}</button>} />
      <div className="flex flex-col gap-1 px-6 pt-2">
        <h1 className="font-jua text-[28px]">모음 입모양 10</h1>
        <p className="text-sm text-sub">거울을 보며 따라 해요. 모음은 입술 모양과 벌린 크기가 소리를 만들어요.</p>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-6 pt-4">
        {GROUPS.map((g) => (
          <section key={g.label} className="flex flex-col gap-2">
            <b className="text-sm text-sub">{g.label}</b>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {VOWEL_LIST.filter((v) => g.ks.includes(v.k)).map((v) => (
                <Card key={v.k} className={cx('flex flex-col items-center gap-1 px-2 py-3', v.k === curVowel && 'ring-2 ring-brand')}>
                  <Mouth shape={v.p} glide={'glide' in v} t={clock.t} on={clock.on} label={`${v.k} 입모양`} id={`m-${v.k}`} />
                  <span className="flex items-baseline gap-1.5">
                    <b className="font-jua text-[26px]">{v.k}</b>
                    <span className="text-sm text-muted">{v.s}</span>
                  </span>
                  {'glide' in v && <span className="text-xs font-bold text-coral-ink">{v.glide}</span>}
                  <span className="text-center text-xs text-sub">{v.cue}</span>
                </Card>
              ))}
            </div>
          </section>
        ))}
        <p className="text-xs leading-relaxed text-muted">ㅑ ㅕ ㅛ ㅠ 는 ‘이’ 입모양에서 시작해 빠르게 옮겨가요. 주황 글씨가 그 순서예요.</p>
      </div>
      {curVowel && (
        <div className="px-5 pb-8 lg:max-w-[360px]">
          <Button href={`/learn/${encodeURIComponent(curVowel)}`}>{curVowel} 레슨 시작하기</Button>
        </div>
      )}
    </AppShell>
  );
}
