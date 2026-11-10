import Link from 'next/link';

export const metadata = { title: '이용약관 · 말랑말랑' };

export default function TermsPage() {
  const rows: [string, string][] = [
    ['서비스', '말랑말랑은 혼자 발음을 연습할 때 내 소리를 눈으로 확인하는 도구예요. 의료 진단이나 언어치료를 대신하지 않아요.'],
    ['결과의 한계', '들린 대로 글자는 음성 인식 모델의 결과라 틀릴 수 있어요. 확실하지 않으면 “확실하지 않아요”로 보여주고, 사람 귀 확인으로 함께 봐요.'],
    ['요금', '지금은 진단과 연습 모두 무료예요.'],
    ['계정', '아이디·비밀번호는 본인이 관리해요. 5번 틀리면 10분 동안 로그인이 잠겨요.'],
    ['올린 원고', '내 글로 연습에 올린 원고는 비교에만 쓰고, 원본 파일은 글을 뽑은 뒤 바로 지워요. 원고도 언제든 지울 수 있어요.'],
    ['금지', '다른 사람의 목소리를 동의 없이 녹음해 올리거나, 받아쓰기 링크를 악용하는 일은 하지 말아 주세요.'],
    ['문의', '[운영자 · 연락처 입력]'],
  ];
  return (
    <main className="mx-auto min-h-dvh max-w-[760px] bg-bg px-5 py-10">
      <Link href="/" className="text-sm font-bold text-brand-dark">
        ← 말랑말랑
      </Link>
      <h1 className="mb-2 mt-4 font-jua text-[32px]">이용약관</h1>
      <p className="mb-6 text-sm text-muted">시행일 2026-11-10</p>
      <dl className="flex flex-col gap-3">
        {rows.map(([t, d]) => (
          <div key={t} className="rounded-2xl bg-white p-4 shadow-chip">
            <dt className="font-bold">{t}</dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-sub">{d}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
