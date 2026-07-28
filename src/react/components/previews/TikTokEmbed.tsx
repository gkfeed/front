import { useEffect, useRef } from 'react';

export function TikTokEmbed({ src, title }: { src: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const playWhenReady = (event: MessageEvent) => {
      const playerWindow = frameRef.current?.contentWindow;
      if (
        event.origin !== 'https://www.tiktok.com' ||
        !playerWindow ||
        event.source !== playerWindow ||
        !isTikTokPlayerReadyMessage(event.data)
      ) return;

      playerWindow.postMessage({ type: 'unMute', 'x-tiktok-player': true }, event.origin);
      playerWindow.postMessage({ type: 'play', 'x-tiktok-player': true }, event.origin);
    };
    window.addEventListener('message', playWhenReady);
    return () => window.removeEventListener('message', playWhenReady);
  }, []);

  return (
    <div className="reader-card__preview reader-card__preview--short-video reader-card__preview--tiktok">
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        allow="autoplay; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

function isTikTokPlayerReadyMessage(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message['x-tiktok-player'] === true && message.type === 'onPlayerReady';
}
