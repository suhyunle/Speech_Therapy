/**
 * 실시간 모음 점(F1·F2) — LPC 포먼트 추정 (기기에서 표시용, 기록 값은 서버 Praat 계산)
 * 1) 약 11~12kHz로 솎아내기 2) 프리엠퍼시스 3) 해밍 창 4) 자기상관 5) Levinson-Durbin
 * 6) LPC 스펙트럼 포락선에서 200Hz 위 첫 두 봉우리 = F1, F2
 */
export function decimate(x: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return x;
  const out = new Float32Array(Math.floor(x.length / factor));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let j = 0; j < factor; j++) s += x[i * factor + j];
    out[i] = s / factor;
  }
  return out;
}

export function lpc(x: Float32Array, order: number): Float64Array | null {
  const n = x.length;
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const pre = i ? x[i] - 0.95 * x[i - 1] : x[i];
    w[i] = pre * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  const r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) {
    let s = 0;
    for (let i = k; i < n; i++) s += w[i] * w[i - k];
    r[k] = s;
  }
  if (r[0] <= 1e-10) return null;
  r[0] *= 1 + 1e-9;
  const a = new Float64Array(order + 1);
  a[0] = 1;
  let e = r[0];
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / e;
    const prev = a.slice();
    for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
    a[i] = k;
    e *= 1 - k * k;
    if (e <= 0) return null;
  }
  return a;
}

export function formantsFromFrame(frame: Float32Array, rate: number): { f1: number; f2: number } | null {
  const factor = Math.max(1, Math.round(rate / 11025));
  const x = decimate(frame, factor);
  const fs = rate / factor;
  const a = lpc(x, 12);
  if (!a) return null;
  const env: number[] = [];
  for (let f = 0; f <= 4000; f += 10) {
    const wv = (2 * Math.PI * f) / fs;
    let re = 0;
    let im = 0;
    for (let k = 0; k < a.length; k++) {
      re += a[k] * Math.cos(wv * k);
      im -= a[k] * Math.sin(wv * k);
    }
    env.push(1 / Math.max(1e-12, re * re + im * im));
  }
  const idx: number[] = [];
  for (let i = 20; i < env.length - 1; i++) if (env[i] > env[i - 1] && env[i] >= env[i + 1]) idx.push(i);
  // 봉우리 양옆 골짜기보다 충분히 솟은 것만 포먼트로 본다 (어깨처럼 생긴 가짜 봉우리 제외)
  const real = idx.filter((i, n) => {
    const left = Math.min(...env.slice(n ? idx[n - 1] : 0, i + 1));
    const right = Math.min(...env.slice(i, (idx[n + 1] ?? env.length - 1) + 1));
    return env[i] / Math.max(left, right) >= 2;
  });
  if (real.length < 2) return null;
  return { f1: real[0] * 10, f2: real[1] * 10 };
}

/** 성인 평균 모음 위치(대략, Hz) — 서버 audio.VOWEL_TARGETS 와 같은 값 */
export const VOWEL_TARGETS: Record<'f' | 'm', Record<string, [number, number]>> = {
  f: { ㅣ: [310, 2790], ㅔ: [500, 2350], ㅐ: [520, 2300], ㅏ: [900, 1550], ㅓ: [630, 1150], ㅗ: [420, 850], ㅜ: [360, 1000], ㅡ: [370, 1600] },
  m: { ㅣ: [280, 2300], ㅔ: [440, 1950], ㅐ: [460, 1900], ㅏ: [750, 1300], ㅓ: [560, 950], ㅗ: [380, 750], ㅜ: [320, 850], ㅡ: [330, 1400] },
};

export function nearestVowel(f1: number, f2: number, targets: Record<string, [number, number]>) {
  let best = '';
  let d = Infinity;
  for (const [k, [a, b]] of Object.entries(targets)) {
    const dd = ((f1 - a) / 150) ** 2 + ((f2 - b) / 400) ** 2;
    if (dd < d) {
      d = dd;
      best = k;
    }
  }
  return best;
}
