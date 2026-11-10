'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { downsample, encodeWav, precheck, TARGET_RATE } from '@/utils/audio';
import { formantsFromFrame } from '@/utils/lpc';

// AudioWorklet: 마이크 입력을 그대로 메인 스레드로 넘긴다
const WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('malang-tap', Tap);
`;

export type MicState = 'idle' | 'requesting' | 'denied' | 'unsupported' | 'ready' | 'recording';

export interface Recording {
  wav: Blob;
  samples: Float32Array;
  durationMs: number;
  precheck: ReturnType<typeof precheck>;
}

/**
 * 녹음 훅. 말하는 동안 보이는 값(크기 막대, 쉬익 미터)은 기기에서 바로 계산한다.
 * level: 0~1 크기, hiss: 4kHz 위 에너지 비율 0~1, history: 최근 크기 막대
 */
export function useRecorder(maxMs = 15_000, opts: { formants?: boolean } = {}) {
  const [state, setState] = useState<MicState>('idle');
  const [level, setLevel] = useState(0);
  const [hiss, setHiss] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);
  // 쉬익 미터: 바람 소리 중심 높이(kHz) · 모음 점: F1·F2 (기기 계산, 표시용)
  const [hissKHz, setHissKHz] = useState<number | null>(null);
  const [vowel, setVowel] = useState<{ f1: number; f2: number } | null>(null);
  const [trail, setTrail] = useState<{ f1: number; f2: number }[]>([]);
  const levelRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>();
  const resolveStop = useRef<((r: Recording | null) => void) | null>(null);

  const release = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(stopTimer.current);
    nodeRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    streamRef.current = null;
    nodeRef.current = null;
  }, []);

  useEffect(() => release, [release]);

  const permission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
      setState('unsupported');
      return false;
    }
    setState('requesting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      s.getTracks().forEach((t) => t.stop());
      setState('ready');
      return true;
    } catch {
      setState('denied');
      return false;
    }
  }, []);

  const start = useCallback(async () => {
    if (state === 'recording') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const src = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'malang-tap');
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      chunksRef.current = [];
      node.port.onmessage = (e) => chunksRef.current.push(e.data as Float32Array);
      src.connect(node);
      src.connect(analyser);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      node.connect(mute).connect(ctx.destination);
      ctxRef.current = ctx;
      streamRef.current = stream;
      nodeRef.current = node;
      analyserRef.current = analyser;
      startRef.current = performance.now();
      setHistory([]);
      setTrail([]);
      setVowel(null);
      setState('recording');

      const time = new Float32Array(analyser.fftSize);
      const freq = new Float32Array(analyser.frequencyBinCount);
      const binHz = ctx.sampleRate / analyser.fftSize;
      let frame = 0;
      const tick = () => {
        analyser.getFloatTimeDomainData(time);
        analyser.getFloatFrequencyData(freq);
        let s = 0;
        for (const x of time) s += x * x;
        const db = 10 * Math.log10(s / time.length + 1e-12);
        const lv = Math.max(0, Math.min(1, (db + 60) / 50));
        let hi = 0;
        let all = 0;
        freq.forEach((d, i) => {
          const p = Math.pow(10, d / 10);
          all += p;
          if (i * binHz >= 4000) hi += p;
        });
        levelRef.current = lv;
        setLevel(lv);
        const ratio = lv > 0.25 ? hi / (all + 1e-12) : 0;
        setHiss(ratio);
        if (ratio > 0.5) {
          let num = 0;
          let den = 0;
          freq.forEach((d, i) => {
            const p = Math.pow(10, d / 10);
            num += p * i * binHz;
            den += p;
          });
          setHissKHz(Math.round((num / den / 1000) * 10) / 10);
        } else if (lv < 0.2) setHissKHz(null);
        if (opts.formants && frame % 3 === 0 && lv > 0.35 && ratio < 0.3) {
          const fm = formantsFromFrame(time, ctx.sampleRate);
          if (fm && fm.f1 > 200 && fm.f1 < 1100 && fm.f2 > 600 && fm.f2 < 3200) {
            setVowel((v) => (v ? { f1: v.f1 * 0.6 + fm.f1 * 0.4, f2: v.f2 * 0.6 + fm.f2 * 0.4 } : fm));
            setTrail((t) => [...t.slice(-24), fm]);
          }
        }
        setElapsed(performance.now() - startRef.current);
        if (frame++ % 3 === 0) setHistory((h) => [...h.slice(-39), lv]);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      stopTimer.current = setTimeout(() => void stop(), maxMs);
    } catch {
      setState('denied');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, maxMs]);

  const stop = useCallback(async (): Promise<Recording | null> => {
    const ctx = ctxRef.current;
    if (!ctx) return null;
    const rate = ctx.sampleRate;
    const durationMs = performance.now() - startRef.current;
    release();
    setState('ready');
    setLevel(0);
    setHiss(0);
    const total = chunksRef.current.reduce((a, c) => a + c.length, 0);
    const all = new Float32Array(total);
    let off = 0;
    for (const c of chunksRef.current) {
      all.set(c, off);
      off += c.length;
    }
    const samples = downsample(all, rate, TARGET_RATE);
    const rec = { wav: encodeWav(samples), samples, durationMs, precheck: precheck(samples) };
    resolveStop.current?.(rec);
    return rec;
  }, [release]);

  return { state, level, levelRef, hiss, hissKHz, vowel, trail, history, elapsed, permission, start, stop, setState };
}
