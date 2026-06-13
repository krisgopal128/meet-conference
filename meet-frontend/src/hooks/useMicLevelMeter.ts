/**
 * useMicLevelMeter — Real-time microphone input level meter.
 *
 * Opens an audio stream from the selected mic, uses a Web Audio AnalyserNode
 * to compute RMS, and updates a DOM element's width directly (no React
 * re-renders). Features fast-attack / slow-release smoothing like a real VU meter.
 *
 * Re-initializes automatically when the mic device changes.
 * Based on the Camera_BG_Blur sample's voice meter implementation.
 */

import { useEffect, useRef } from 'react';

export function useMicLevelMeter(
  micDeviceId: string | undefined,
  enabled: boolean,
  meterFillRef: React.RefObject<HTMLElement | null>,
) {
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const levelRef = useRef(0);

  useEffect(() => {
    const meterEl = meterFillRef.current;

    if (!enabled) {
      if (meterEl) meterEl.style.width = '0%';
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: micDeviceId
            ? {
                deviceId: { exact: micDeviceId },
                echoCancellation: true,
                noiseSuppression: true,
              }
            : { echoCancellation: true, noiseSuppression: true },
          video: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;

        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') await ctx.resume();

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);

        analyserRef.current = analyser;
        samplesRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));

        const tick = () => {
          const analyser = analyserRef.current;
          const samples = samplesRef.current;
          if (!analyser || !samples) return;

          analyser.getByteTimeDomainData(samples);

          // RMS of the waveform (centered around 128)
          let sumSq = 0;
          for (let i = 0; i < samples.length; i++) {
            const v = (samples[i] - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / samples.length);

          // Scale into a perceptual 0..1 range
          const target = Math.min(1, rms * 3.2);

          // Fast attack, slow release
          const k = target > levelRef.current ? 0.6 : 0.08;
          levelRef.current += (target - levelRef.current) * k;

          if (meterEl) {
            meterEl.style.width = (levelRef.current * 100).toFixed(1) + '%';
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // Mic denied or unavailable — meter stays at 0
        if (meterEl) meterEl.style.width = '0%';
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      samplesRef.current = null;
      levelRef.current = 0;
      if (meterEl) meterEl.style.width = '0%';
    };
  }, [micDeviceId, enabled, meterFillRef]);
}
