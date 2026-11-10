'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { AppShell, BackHeader, Button, Card, Empty, ErrorState, Loading } from '@/components/ui';
import { ListenerTable, type MyLink } from '@/features/share/ListenerTable';
import { errorText } from '@/services/api';
import { listenApi } from '@/services/endpoints';

const norm = (s: string | null | undefined) => (s ?? '').replace(/[\s.?!,]/g, '');

/** 디자인: ListenerResult · 사람 귀 vs 앱 */
export default function ListenerResultPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['listen-links'], queryFn: () => listenApi.mine() as Promise<MyLink[]> });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState message={errorText(q.error)} onRetry={() => q.refetch()} />;
  const l = q.data?.find((x) => x.id === id);
  if (!l) return <Empty title="링크를 찾을 수 없어요" action={<Button href="/share">사람 귀 확인으로</Button>} />;
  const sentences = l.items.filter((i) => i.target.length > 6);
  const allGotSentence = sentences.length > 0 && l.listeners > 0 && sentences.every((i) => i.answers.length >= l.listeners && i.answers.every((a) => norm(a.text) === norm(i.target)));
  return (
    <AppShell tabs={false}>
      <BackHeader title={`사람 귀로 확인 · ${l.listeners}명이 들었어요`} href="/share" />
      <div className="px-6 pt-2">
        <h1 className="font-jua text-[26px] leading-tight">
          {l.agreement.total}개 중 {l.agreement.agree}개는
          <br />
          사람과 앱이 같게 들었어요
        </h1>
      </div>
      <Card className="mx-5 mt-4">
        <ListenerTable link={l} />
      </Card>
      <div className="mt-auto flex flex-col gap-2 px-5 pb-8 pt-5">
        {allGotSentence && <span className="self-start rounded-full bg-pass-soft px-3 py-1.5 text-[13px] font-bold text-pass-ink">문장은 {l.listeners === 1 ? '듣는 사람이' : `${l.listeners}명 모두`} 알아들었어요!</span>}
        <Button href="/home">학습으로 돌아가기</Button>
      </div>
    </AppShell>
  );
}
