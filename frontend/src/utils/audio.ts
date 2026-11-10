/** 녹음 → 16kHz 모노 PCM16 WAV (분석 워커 입력 형식) */
export const TARGET_RATE = 16000;

export function downsample(input: Float32Array, fromRate: number, toRate = TARGET_RATE): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    // 구간 평균 (간단한 저역 통과 + 솎아내기)
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export function encodeWav(samples: Float32Array, rate = TARGET_RATE): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** 기기에서 먼저 하는 녹음 검사 (서버가 한 번 더 확인). 디자인 메모 '녹음 문제 5가지' 중 3가지. */
export function precheck(samples: Float32Array, rate = TARGET_RATE): 'too_quiet' | 'too_short' | 'clipped' | null {
  const frame = Math.round(rate * 0.025);
  const hop = Math.round(rate * 0.01);
  let peakDb = -120;
  const dbs: number[] = [];
  let clipped = 0;
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]) >= 0.99) clipped++;
  for (let i = 0; i + frame <= samples.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + frame; j++) s += samples[j] * samples[j];
    const db = 10 * Math.log10(s / frame + 1e-12);
    dbs.push(db);
    peakDb = Math.max(peakDb, db);
  }
  if (clipped / Math.max(1, samples.length) > 0.001) return 'clipped';
  if (peakDb < -40) return 'too_quiet';
  const sorted = [...dbs].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? -120;
  const voiced = dbs.filter((d) => d > Math.max(floor + 10, -45)).length * (hop / rate);
  if (voiced < 0.3) return 'too_short';
  return null;
}
