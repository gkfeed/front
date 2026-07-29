import { useEffect, useRef, useState } from 'react';

type TikTokEmbedProps = {
  src: string;
  title: string;
  requiresSoundGesture: boolean;
};

export function TikTokEmbed({ src, title, requiresSoundGesture }: TikTokEmbedProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [showSoundPrompt, setShowSoundPrompt] = useState(requiresSoundGesture);

  useEffect(() => {
    const playWhenReady = (event: MessageEvent) => {
      const playerWindow = frameRef.current?.contentWindow;
      if (
        event.origin !== 'https://www.tiktok.com' ||
        !playerWindow ||
        event.source !== playerWindow ||
        !isTikTokPlayerReadyMessage(event.data)
      ) return;

      if (!requiresSoundGesture) {
        playerWindow.postMessage({ type: 'unMute', 'x-tiktok-player': true }, event.origin);
      }
      playerWindow.postMessage({ type: 'play', 'x-tiktok-player': true }, event.origin);
    };
    window.addEventListener('message', playWhenReady);
    return () => window.removeEventListener('message', playWhenReady);
  }, [requiresSoundGesture]);

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
      {showSoundPrompt ? (
        <button
          type="button"
          className="reader-card__sound-toggle"
          onClick={() => {
            frameRef.current?.contentWindow?.postMessage(
              { type: 'unMute', 'x-tiktok-player': true },
              'https://www.tiktok.com',
            );
            frameRef.current?.contentWindow?.postMessage(
              { type: 'play', 'x-tiktok-player': true },
              'https://www.tiktok.com',
            );
            setShowSoundPrompt(false);
          }}
        >
          Tap for sound
        </button>
      ) : null}
    </div>
  );
}

function isTikTokPlayerReadyMessage(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message['x-tiktok-player'] === true && message.type === 'onPlayerReady';
}
