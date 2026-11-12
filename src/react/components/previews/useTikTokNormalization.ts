import { useEffect, useRef, useState, type RefObject } from 'react';

type AudioGraph = { context: AudioContext; input: MediaElementAudioSourceNode; compressor: DynamicsCompressorNode };

export function useTikTokNormalization(ref: RefObject<HTMLMediaElement | null>) {
  const [enabled, setEnabled] = useState(false);
  const graph = useRef<AudioGraph | null>(null);

  useEffect(() => () => {
    if (graph.current) void graph.current.context.close();
    graph.current = null;
  }, []);

  const toggle = () => {
    const media = ref.current;
    if (!media || typeof AudioContext === 'undefined') return;
    try {
      if (!graph.current) {
        const context = new AudioContext();
        const input = context.createMediaElementSource(media);
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 20;
        compressor.ratio.value = 6;
        const gain = context.createGain();
        gain.gain.value = 3;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.003;
        compressor.connect(gain).connect(limiter).connect(context.destination);
        graph.current = { context, input, compressor };
      }
      const { context, input, compressor } = graph.current;
      input.disconnect();
      input.connect(enabled ? context.destination : compressor);
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      setEnabled(!enabled);
    } catch {
      // Leave the original media playback in place when Web Audio is unavailable.
    }
  };

  return { enabled, toggle };
}

export function tikTokMediaProxy(url: string): string {
  return `/bff/tiktok-media?url=${encodeURIComponent(url)}`;
}
