import Link from 'next/link';

export const metadata = { title: '개인정보 처리방침 · 말랑말랑' };

/** 디자인 기술 설계 6장 '개인정보 · 안전' 을 바탕으로 한 처리방침. [ ] 칸은 운영자가 채운다. */
export default function PrivacyPage() {
  const rows: [string, string][] = [
    ['모으는 정보', '아이디·이름(또는 카카오·구글 계정 식별자), 태어난 해(선택), 만 14세 미만일 때 보호자 이름·연락처, 목소리 녹음, 녹음 분석 결과(들린 글자·측정값), 연습 기록, 한 줄 일기, 기기 정보(브라우저 종류)'],
    ['쓰는 곳', '발음 연습 결과를 보여주고 기록을 이어가는 데만 써요. 모델 개선·연구에 쓰는 것은 따로 선택 동의를 받아요.'],
    ['녹음 보관', '녹음 원본은 암호화(AES-256)해서 보관하고, 설정한 기간(기본 90일 · 30일 · 1년 · 내가 지울 때까지)이 지나면 자동으로 지워요. 분석 결과 글자와 측정값만 남아요.'],
    ['지우기', '설정 → 「내 녹음 전부 지우기」, 「계정 삭제」로 언제든 지울 수 있어요. 계정을 지우면 모든 기록이 함께 지워져요.'],
    ['사람 귀 확인', '받아쓰기 링크는 7일 뒤 사라지고, 듣는 사람에게 학습자 이름을 보여주지 않아요. 듣는 사람의 이름·연락처는 받지 않아요.'],
    ['연구 모드', '연구로 쓸 때는 소속 기관 또는 공용 IRB 승인 뒤에만 써요. 다른 사람이 적은 받아쓰기는 그 사람의 동의도 필요해요.'],
    ['만 14세 미만', '법정대리인(보호자) 동의를 받아요.'],
    ['보안', '전송은 HTTPS, 저장소는 암호화. 녹음은 로그인한 본인 요청으로만 재생돼요.'],
    ['출시 소식', '랜딩페이지에서 신청한 이메일은 출시 소식을 보내는 데만 써요.'],
    ['책임자 · 문의', '[개인정보 보호책임자 · 연락처 입력]'],
  ];
  return (
    <main className="mx-auto min-h-dvh max-w-[760px] bg-bg px-5 py-10">
      <Link href="/" className="text-sm font-bold text-brand-dark">
        ← 말랑말랑
      </Link>
      <h1 className="mb-2 mt-4 font-jua text-[32px]">개인정보 처리방침</h1>
      <p className="mb-6 text-sm text-muted">시행일 2026-11-10 · 버전 2026-11-10</p>
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
