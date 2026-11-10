'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AppShell, Button, Card, Loading, cx } from '@/components/ui';
import { errorText } from '@/services/api';
import { scriptsApi } from '@/services/endpoints';

const ACCEPT = '.pptx,.pdf,image/png,image/jpeg,image/webp';

/** 디자인: MyScript · WebMyScript · 발표자료를 올리고 그대로 읽어보세요 */
export default function ScriptHome() {
  const router = useRouter();
  const docs = useQuery({ queryKey: ['scripts'], queryFn: scriptsApi.list });
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [drag, setDrag] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const photo = useRef<HTMLInputElement>(null);
  const up = useMutation({
    mutationFn: (x: File | { text: string; title: string }) => (x instanceof File ? scriptsApi.createFile(x) : scriptsApi.createText(x.text, x.title || undefined)),
    onSuccess: (d) => router.push(`/script/${d.id}`),
  });
  const pick = (f?: File | null) => f && up.mutate(f);
  return (
    <AppShell wide>
      <div className="flex flex-col gap-1 px-6 pt-10 lg:px-0 lg:pt-4">
        <span className="text-[13px] font-bold text-brand-dark">자유 연습 · 내 글로</span>
        <h1 className="font-jua text-[28px] leading-tight lg:text-[32px]">발표자료를 올리고 그대로 읽어보세요</h1>
        <p className="text-sm leading-relaxed text-sub">올린 글이 정답이 돼요. 길게 읽어도 문장마다 맞춰보고, 달라진 발음을 짚어드려요.</p>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-10 pt-4 lg:grid lg:grid-cols-[1.3fr_1fr] lg:items-start lg:px-0">
        <div className="flex flex-col gap-3">
          <div role="tablist" className="grid grid-cols-3 gap-2">
            <button type="button" role="tab" aria-selected={mode === 'file'} onClick={() => (setMode('file'), file.current?.click())} className={cx('min-h-[64px] rounded-2xl text-sm font-bold', mode === 'file' ? 'bg-brand text-white shadow-btn' : 'bg-white shadow-chip')}>
              PPT · PDF
            </button>
            <button type="button" onClick={() => photo.current?.click()} className="min-h-[64px] rounded-2xl bg-white text-sm font-bold shadow-chip">
              사진 찍기
            </button>
            <button type="button" role="tab" aria-selected={mode === 'text'} onClick={() => setMode('text')} className={cx('min-h-[64px] rounded-2xl text-sm font-bold', mode === 'text' ? 'bg-brand text-white shadow-btn' : 'bg-white shadow-chip')}>
              글 붙여넣기
            </button>
          </div>
          <input ref={file} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <input ref={photo} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          {mode === 'file' ? (
            <div
              onDragOver={(e) => (e.preventDefault(), setDrag(true))}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => (e.preventDefault(), setDrag(false), pick(e.dataTransfer.files?.[0]))}
              className={cx('flex flex-col items-center gap-2 rounded-[26px] border-[3px] border-dashed px-5 py-10 text-center', drag ? 'border-brand bg-brand-soft' : 'border-line2 bg-white')}
            >
              <b className="text-[17px]">파일을 여기에 끌어다 놓기</b>
              <span className="text-sm text-sub">PPT · PDF · 사진(글자를 읽어요) · 또는 글 붙여넣기</span>
              <Button className="mt-2 w-auto px-6" onClick={() => file.current?.click()} disabled={up.isPending}>
                {up.isPending ? '올리는 중…' : '파일 고르기'}
              </Button>
            </div>
          ) : (
            <Card className="flex flex-col gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 (선택)" maxLength={80} className="min-h-[48px] rounded-[14px] border-2 border-line px-3.5 outline-none focus:border-brand" />
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={20000} placeholder="읽을 글을 붙여 넣어요. 빈 줄로 나누면 슬라이드처럼 나눠요." className="resize-y rounded-[14px] border-2 border-line px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-brand" />
              <span className="text-right text-xs text-muted">{text.length.toLocaleString()}자</span>
              <Button disabled={text.trim().length < 2 || up.isPending} onClick={() => up.mutate({ text, title })}>
                이 글로 연습하기
              </Button>
            </Card>
          )}
          {up.error && <p role="alert" className="rounded-2xl bg-coral-soft px-4 py-3 text-sm font-bold text-coral-ink">{errorText(up.error)}</p>}
          <p className="text-xs leading-relaxed text-muted">원고는 비교에만 쓰고, 원하면 바로 지울 수 있어요. 사진은 글자를 읽어서(OCR) 원고로 만들어요. 손글씨는 잘 못 읽어요.</p>
        </div>
        <div className="flex flex-col gap-2">
          <b className="text-sm">내 원고</b>
          {docs.isLoading && <Loading />}
          {docs.data?.length === 0 && <span className="rounded-2xl bg-white p-4 text-sm text-muted shadow-chip">아직 올린 원고가 없어요</span>}
          {docs.data?.map((d) => (
            <Link key={d.id} href={`/script/${d.id}`} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-chip">
              <span className="flex flex-col">
                <b className="text-[15px]">{d.title}</b>
                <span className="text-xs text-muted">
                  {d.status === 'EXTRACTING' ? '글자를 찾는 중…' : d.status === 'FAILED' ? (d.error ?? '글을 찾지 못했어요') : `${d.slides?.length ?? 0}장 · ${d.charCount.toLocaleString()}자`}
                </span>
              </span>
              <span aria-hidden className="text-muted">›</span>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
