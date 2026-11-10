'use client';
import { useQuery } from '@tanstack/react-query';
import { AppShell, BackHeader, Button, Card, Empty, ErrorState, Loading } from '@/components/ui';
import { VowelTriangle, vowelHints } from '@/features/progress/VowelTriangle';
import { errorText } from '@/services/api';
import { planApi, progressApi } from '@/services/endpoints';

/** 디자인: VowelSpace · 내 모음 지도 ㅣ ㅏ ㅜ */
export default function VowelSpacePage() {
  const s = useQuery({ queryKey: ['progress'], queryFn: progressApi.summary });
  const plan = useQuery({ queryKey: ['plan'], queryFn: planApi.today });
  if (s.isLoading) return <Loading />;
  if (s.error || !s.data) return <ErrorState message={errorText(s.error)} onRetry={() => s.refetch()} />;
  const v = s.data.vowels;
  const set = plan.data?.vowelSet ?? 'f';
  const ready = Object.keys(v.latest).length >= 3;
  const hints = ready ? vowelHints(v.latest, set) : [];
  const grow = v.areaIndex != null ? v.areaIndex - 100 : null;
  return (
    <AppShell tabs={false}>
      <BackHeader title="내 모음 지도 · ㅣ ㅏ ㅜ" href="/progress" />
      {!ready ? (
        <Empty title="아직 모음 점이 모자라요" desc="ㅣ·ㅏ·ㅜ가 들어간 단어를 녹음하면 내 모음 삼각형이 그려져요." action={<Button href="/home">연습하러 가기</Button>} />
      ) : (
        <>
          <div className="flex flex-col gap-1 px-6 pt-2">
            <h1 className="whitespace-pre-line font-jua text-[26px] leading-tight">{hints.length ? '내 모음이 가운데로\n모여 있어요' : '세 모음이 잘 떨어져 있어요'}</h1>
            <p className="text-sm text-sub">세 모음이 멀리 떨어질수록 서로 덜 헷갈려요.</p>
          </div>
          <Card className="mx-5 mt-3">
            <VowelTriangle first={v.first} latest={v.latest} set={set} />
          </Card>
          <div className="flex flex-col gap-2 px-5 pt-3">
            {hints.map((h) => (
              <Card key={h.k} className="flex items-center gap-3 py-3">
                <b className="font-jua text-[24px] text-brand">{h.k}</b>
                <span className="text-sm">{h.text}</span>
              </Card>
            ))}
          </div>
          <div className="mt-auto flex flex-col gap-2 px-5 pb-8 pt-5">
            {grow != null && grow > 0 && <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">처음보다 삼각형 넓이가 {grow}% 커졌어요!</span>}
            <Button href="/soundmap/vowels">끝 모음 3개 연습하기</Button>
            <Button variant="ghost" href="/progress">
              성장 기록 전체 보기
            </Button>
          </div>
        </>
      )}
    </AppShell>
  );
}
