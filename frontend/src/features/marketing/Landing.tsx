'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Logo, Mascot, cx } from '@/components/ui';
import { errorText } from '@/services/api';
import { notifyApi } from '@/services/endpoints';

const STEPS = [
  ['4분 진단', '글자, 단어, 문장 순서로 읽어요. 세 단계 모두 잘 된 소리는 처음부터 클리어돼요.'],
  ['그림으로 배우기', '혀가 어디에 닿는지, 입술을 어떻게 하는지 그림으로 봐요. 손으로 바람과 떨림을 느끼는 방법도 알려줘요.'],
  ['직접 말하기', '실제로 녹음해야 다음으로 넘어가요. 보기만 하고 넘어가는 연습은 없어요.'],
  ['눈으로 확인', '들린 그대로의 글자와 소리 모양을 목표와 나란히 비교해요. 무엇을 고치면 되는지 한 줄로 알려줘요.'],
];
const FAQ = [
  ['카메라로 얼굴을 찍나요?', '아니요. 마이크 녹음만 사용해요. 입 모양은 그림으로 배우고, 확인은 소리로 해요.'],
  ['언어치료를 대신할 수 있나요?', '대신하지는 않아요. 혼자 연습할 때 내 소리를 확인하는 도구예요. 치료를 받고 있다면 선생님과 함께 쓰시길 권해요.'],
  ['소리를 전혀 못 들어도 쓸 수 있나요?', '네. 모든 안내와 결과가 글자, 색, 그림으로 나와요. 소리를 듣지 않아도 되도록 만들었어요.'],
  ['돈을 내야 하나요?', '아니요. 지금은 진단과 연습 모두 무료예요.'],
];
const TICKER = ['ㄱ', 'ㅏ', '쉬익—', 'ㄹ', 'ㅓ', '톡!', 'ㅁ', 'ㅗ', '웅웅', 'ㅅ', 'ㅣ', '팍!'];

/** 디자인: Landing · 웹 마케팅 랜딩페이지 */
export function Landing() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(0);
  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await notifyApi.newsletter(email);
      setMsg('신청했어요! 출시되면 이 주소로 알려드릴게요.');
      setEmail('');
    } catch (err) {
      setMsg(errorText(err));
    }
  };
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-bg/95 backdrop-blur">
        <nav className="mx-auto flex max-w-[1200px] items-center gap-6 px-5 py-3 lg:px-10" aria-label="랜딩 메뉴">
          <Logo />
          <span className="ml-auto hidden gap-6 text-[15px] font-bold text-sub md:flex">
            <a href="#how">이렇게 연습해요</a>
            <a href="#features">기능</a>
            <a href="#faq">자주 묻는 질문</a>
          </span>
          <Link href="/login" className="ml-auto rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-[0_3px_0_#3F31D6] md:ml-0">
            무료 진단
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 pb-16 pt-12 lg:grid-cols-[1.1fr_1fr] lg:px-10 lg:pt-20">
        <div className="flex flex-col gap-5">
          <span className="self-start rounded-full bg-brand-soft px-3 py-1.5 text-sm font-bold text-brand-dark">소리를 눈으로 보는 발음 연습</span>
          <h1 className="font-jua text-[44px] leading-[1.1] lg:text-[68px]">
            들리지 않아도,
            <br />
            내 말소리를
            <br />
            <span className="text-brand">눈으로 봐요</span>
          </h1>
          <p className="max-w-[520px] text-[17px] leading-relaxed text-sub">혀와 입 모양은 그림으로 배우고, 말하면 내 소리를 고치지 않고 들린 그대로 글자와 모양으로 보여드려요. 소리를 못 들어도 혼자 연습할 수 있어요.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button href="/login" className="sm:w-auto sm:px-8">
              무료로 4분 진단 시작
            </Button>
          </div>
          <span className="text-sm text-muted">앱과 웹 둘 다 · 카메라 없이 마이크만 사용해요</span>
        </div>
        <div className="relative mx-auto w-full max-w-[380px]">
          <div className="flex flex-col gap-3 rounded-[36px] bg-white p-5 shadow-[0_12px_0_#E6E3F2]">
            <span className="text-xs font-bold text-brand-dark">따라 말하기</span>
            <span className="text-center font-jua text-[64px] tracking-[0.2em]">사 과</span>
            <div className="flex flex-col gap-1 rounded-2xl bg-ink px-4 py-3 text-white">
              <span className="text-[11px] font-bold text-[#C8C5DD]">들린 대로</span>
              <span className="font-jua text-[30px]">
                <span className="rounded-md bg-coral px-1 text-ink">다</span> 과
              </span>
            </div>
            <b className="text-[15px] text-coral-ink">ㅅ이 ㄷ처럼 났어요</b>
            <span className="text-sm text-sub">혀끝을 살짝 떼고 틈으로 바람을 내요</span>
            <span className="flex h-12 items-center justify-center rounded-2xl bg-brand font-jua text-lg text-white shadow-btn">다시 녹음</span>
          </div>
          <div className="absolute -left-6 -top-6 flex flex-col items-center rounded-2xl bg-pass px-3 py-2 font-jua text-white shadow-pass">
            <span className="text-2xl">ㄹ</span>
            <span className="text-[11px]">이미 발음이 좋아요</span>
          </div>
          <span className="absolute -bottom-4 -right-3 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-coral-ink shadow-chip">3일 연속 연습</span>
        </div>
      </section>

      <div className="overflow-hidden border-y-2 border-line bg-white py-3" aria-hidden>
        <div className="flex w-max animate-[ticker_24s_linear_infinite] gap-6 font-jua text-[22px] text-faint">
          {[...TICKER, ...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className={t.length > 1 ? 'text-coral' : ''}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <section className="mx-auto grid max-w-[1200px] gap-8 px-5 py-16 lg:grid-cols-2 lg:px-10">
        <blockquote className="font-jua text-[30px] leading-snug lg:text-[38px]">
          “발음 연습할 때
          <br />
          제일 어려운 건,
          <br />내 소리를 모른다는 거예요”
        </blockquote>
        <div className="flex flex-col gap-4 text-[17px] leading-relaxed text-sub">
          <p>듣는 사람은 귀로 고치지만, 소리가 잘 안 들리면 맞게 말했는지 알기 어려워요. 그래서 수업이 없는 날에는 혼자 연습하기 힘들어요.</p>
          <p>
            말랑말랑은 귀 대신 눈으로 확인하게 해줘요. <b className="text-coral-ink">바람은 주황</b>, <b className="text-brand">목소리는 보라</b>. 내 소리가 어떻게 나왔는지 바로 보여요.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 pb-16 lg:px-10">
        <h2 className="mb-6 font-jua text-[32px]">귀 대신, 눈으로</h2>
        <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
          <div className="flex flex-col gap-2 rounded-[28px] bg-white p-6 shadow-card">
            <span className="text-sm font-bold text-muted">귀로만 확인하면</span>
            <span className="font-jua text-[56px] text-line2">?</span>
            <span className="text-[15px]">“사과”라고 했는데… 맞게 말했을까?</span>
            <span className="text-sm text-sub">소리가 잘 안 들리면 무엇이 달랐는지 알 길이 없어요.</span>
          </div>
          <span className="hidden font-jua text-[28px] text-brand md:block">› › ›</span>
          <div className="flex flex-col gap-2 rounded-[28px] bg-brand p-6 text-white shadow-btn">
            <span className="text-sm font-bold text-brand-light">말랑말랑으로 보면</span>
            <span className="font-jua text-[44px]">
              <span className="rounded-md bg-coral px-1 text-ink">다</span> 과 <span className="text-[24px]">ㅅ → ㄷ</span>
            </span>
            <span className="text-[15px]">ㅅ이 ㄷ처럼 났구나! 바람이 짧았네</span>
            <span className="text-sm text-brand-light">어떤 소리가, 어떻게 달랐는지 바로 보여요.</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['가', '소리 → 글자', '들린 그대로 적어줘요'],
            ['●', '소리 → 색', '바람은 주황, 목소리는 보라'],
            ['👄', '소리 → 모양', '입 모양과 혀 위치 그림'],
            ['∿', '소리 → 진동', '손으로도 느껴요'],
          ].map(([k, t, d]) => (
            <div key={t} className="flex flex-col gap-1 rounded-[22px] bg-white p-4 shadow-chip">
              <span className="font-jua text-[26px] text-brand" aria-hidden>
                {k === '👄' ? '◡' : k}
              </span>
              <b>{t}</b>
              <span className="text-sm text-sub">{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="bg-white py-16">
        <div className="mx-auto max-w-[1200px] px-5 lg:px-10">
          <span className="text-sm font-bold text-brand-dark">이렇게 연습해요</span>
          <h2 className="mb-8 font-jua text-[32px]">진단부터 확인까지, 네 걸음</h2>
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="flex flex-col gap-2 rounded-[26px] bg-bg p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand font-jua text-xl text-white">{i + 1}</span>
                <b className="font-jua text-[22px] font-normal">{t}</b>
                <span className="text-[15px] leading-relaxed text-sub">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10">
        <span className="text-sm font-bold text-brand-dark">기능</span>
        <h2 className="mb-8 font-jua text-[32px]">고치지 않고, 있는 그대로</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="flex flex-col gap-3 rounded-[28px] bg-white p-6 shadow-card lg:row-span-2">
            <span className="text-sm font-bold text-coral-ink">들린 대로</span>
            <h3 className="font-jua text-[26px]">받아쓰기가 아니라 정답과 비교하기</h3>
            <p className="text-[15px] leading-relaxed text-sub">보통 음성인식은 ‘무슨 말을 하려 했나’를 맞히는 게 목표라, “오머니”라고 해도 “어머니”로 고쳐 적어요. 말랑말랑은 정답을 이미 알고 시작해요. 실제로 낸 소리를 정답과 한 소리씩 맞대어 보고, 바뀐 소리·빠진 소리·더해진 소리를 짚어줘요.</p>
            <dl className="grid grid-cols-[90px_1fr] gap-y-2 rounded-2xl bg-bg p-4 font-jua text-[22px]">
              <dt className="text-sm font-sans font-bold text-muted">목표</dt>
              <dd>어머니</dd>
              <dt className="text-sm font-sans font-bold text-muted">보통 인식</dt>
              <dd className="text-faint">어머니</dd>
              <dt className="text-sm font-sans font-bold text-muted">들린 대로</dt>
              <dd>
                <span className="rounded-md bg-coral px-1">오</span> 머니
              </dd>
            </dl>
          </article>
          <article className="flex flex-col gap-2 rounded-[28px] bg-white p-6 shadow-card">
            <span className="text-sm font-bold text-brand-dark">소리 모양</span>
            <h3 className="font-jua text-[24px]">바람은 주황, 목소리는 보라</h3>
            <p className="text-[15px] text-sub">“사과”를 말하면 ㅅ의 바람과 ‘아’의 목소리가 어떻게 이어졌는지, 어디서 끊겼는지 목표 모양 옆에 보여줘요.</p>
            <div className="flex h-12 items-center gap-[3px]" aria-hidden>
              {Array.from({ length: 32 }, (_, k) => (
                <span key={k} className={cx('w-full rounded-full', k < 10 ? 'bg-coral' : k < 12 ? 'bg-line' : 'bg-brand')} style={{ height: `${k < 10 ? 45 : k < 12 ? 10 : 80 - Math.abs(20 - k) * 3}%` }} />
              ))}
            </div>
          </article>
          <article className="flex flex-col gap-2 rounded-[28px] bg-white p-6 shadow-card">
            <span className="text-sm font-bold text-brand-dark">모음 지도</span>
            <h3 className="font-jua text-[24px]">ㅓ와 ㅗ, 어디쯤 찍혔나</h3>
            <p className="text-[15px] text-sub">모음은 내 소리를 지도 위 점으로 찍어줘요. 목표 칸 밖이면 어느 쪽으로 갔는지 바로 보여요.</p>
          </article>
          <article className="flex flex-col gap-2 rounded-[28px] bg-white p-6 shadow-card">
            <span className="text-sm font-bold text-pass-text">맞춤 시작</span>
            <h3 className="font-jua text-[24px]">아는 소리는 건너뛰어요</h3>
            <div className="flex gap-1.5">
              {['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅏ', 'ㅓ'].map((s, k) => (
                <span key={s} className={cx('flex h-11 w-11 items-center justify-center rounded-xl font-jua text-xl', k % 3 === 2 ? 'bg-white text-ink shadow-chip' : 'bg-pass text-white')}>
                  {s}
                </span>
              ))}
            </div>
            <p className="text-[15px] text-sub">자음 13개, 모음 10개를 글자·단어·문장으로 확인해요. 이미 잘하는 소리는 클리어하고, 필요한 소리부터 연습해요.</p>
          </article>
          <article className="flex flex-col gap-2 rounded-[28px] bg-ink p-6 text-white">
            <h3 className="font-jua text-[24px]">점수 대신, 사실만</h3>
            <p className="text-[15px] leading-relaxed text-[#C8C5DD]">근거 없는 “87점”은 보여주지 않아요. 어떤 소리가 바뀌었는지, 목소리 크기·높이·빠르기가 어땠는지처럼 실제로 잰 것만 알려드리고, 통과와 다시는 그 측정값으로 정해요.</p>
          </article>
          <article className="flex flex-col gap-2 rounded-[28px] bg-white p-6 shadow-card">
            <h3 className="font-jua text-[24px]">앱에서도, 웹에서도</h3>
            <p className="text-[15px] text-sub">출퇴근길엔 휴대폰으로, 집에서는 큰 화면으로. 학습 기록은 그대로 이어져요. 카메라는 쓰지 않고 마이크만 있으면 돼요.</p>
          </article>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-[1200px] gap-4 px-5 md:grid-cols-3 lg:px-10">
          <h2 className="font-jua text-[30px] md:col-span-3">이런 분들과 함께해요</h2>
          {[
            ['발음을 연습하고 싶은 분', '보청기·인공와우 사용자도, 누구나 혼자서 매일 조금씩 연습할 수 있어요.'],
            ['곁에서 돕는 가족', '무엇을 어떻게 연습하는지 화면으로 함께 보며 응원할 수 있어요.'],
            ['언어재활 선생님', '수업과 수업 사이, 집에서 할 연습 과제로 써보세요.'],
          ].map(([t, d]) => (
            <div key={t} className="flex flex-col gap-2 rounded-[24px] bg-bg p-5">
              <b className="font-jua text-[22px] font-normal">{t}</b>
              <span className="text-[15px] text-sub">{d}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-5 py-16 lg:px-10">
        <h2 className="mb-6 font-jua text-[30px]">연구가 가리키는 순서대로</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ['모음부터', '자기 소리를 잘 듣기 어려우면 모음이 가운데로 모이는 경향이 있어요. 자음·모음을 바로잡았을 때 알아듣는 정도가 억양만 고쳤을 때보다 훨씬 크게 올랐어요.', '아동 말 교정 실험 (영어권)'],
            ['ㅅ은 그래프로', 'ㅅ은 자주 빠지거나 ‘쉬’처럼 나요. 바람 소리의 높이를 막대로 보여주면 들리지 않아도 바로 확인할 수 있어요.', '아동 마찰음 음향 연구 (국내)'],
            ['기준은 사람 귀', '자동 판정은 아직 완벽하지 않아요. 그래서 단정하지 않고 “이렇게 들렸어요”를 보여주고, 사람의 받아쓰기로 계속 확인해요.', '발음 오류 자동 검출 연구 · 받아쓰기 명료도 평가'],
          ].map(([t, d, src]) => (
            <div key={t} className="flex flex-col gap-2 rounded-[24px] bg-white p-5 shadow-chip">
              <b className="font-jua text-[22px] font-normal">{t}</b>
              <span className="text-[15px] leading-relaxed text-sub">{d}</span>
              <span className="mt-auto text-xs text-muted">{src}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="bg-white py-16">
        <div className="mx-auto max-w-[820px] px-5">
          <h2 className="mb-6 font-jua text-[30px]">자주 묻는 질문</h2>
          {FAQ.map(([q, a], i) => (
            <div key={q} className="border-b-2 border-line">
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex min-h-[60px] w-full items-center justify-between text-left text-[17px] font-bold">
                {q}
                <span aria-hidden className="text-faint">
                  {open === i ? '−' : '+'}
                </span>
              </button>
              {open === i && <p className="pb-5 text-[15px] leading-relaxed text-sub">{a}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-5 py-20 text-center">
        <Mascot size={96} mood="happy" className="mallang" />
        <h2 className="font-jua text-[36px] leading-tight lg:text-[48px]">
          오늘, 내 소리를
          <br />
          처음으로 봐요
        </h2>
        <p className="text-[17px] text-sub">4분이면 지금 발음이 어떤지 알 수 있어요.</p>
        <form onSubmit={subscribe} className="flex w-full max-w-[460px] flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="nl-email">
            이메일
          </label>
          <input id="nl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="출시 소식 받을 이메일" className="h-14 flex-1 rounded-2xl border-2 border-line bg-white px-4 outline-none focus:border-brand" />
          <button type="submit" className="h-14 rounded-2xl bg-ink px-6 font-bold text-white">
            알림 신청
          </button>
        </form>
        {msg && (
          <p role="status" className="text-sm font-bold text-brand-dark">
            {msg}
          </p>
        )}
        <span className="text-xs text-muted">이메일은 출시 소식을 보내는 데만 써요.</span>
        <Link href="/login" className="font-bold text-brand-dark">
          지금 웹에서 무료 진단 해보기 →
        </Link>
      </section>

      <footer className="border-t-2 border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-5 py-6 text-sm text-muted lg:px-10">
          <Logo size={18} />
          <span>ship and giggle</span>
          <span className="ml-auto flex gap-4">
            <Link href="/privacy">개인정보 처리방침</Link>
            <Link href="/terms">이용약관</Link>
            <span>문의 [연락처 입력]</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
