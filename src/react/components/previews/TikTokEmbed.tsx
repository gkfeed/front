import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createTikTokPlayerAdapter } from './tikTokPlayerProtocol';

type TikTokEmbedProps = {
  src: string;
  title: string;
  requiresSoundGesture: boolean;
};

export function TikTokEmbed({ src, title, requiresSoundGesture }: TikTokEmbedProps) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [showSoundPrompt, setShowSoundPrompt] = useState(requiresSoundGesture);
  const playerAdapter = useMemo(
    () => createTikTokPlayerAdapter(() => frameRef.current?.contentWindow ?? null),
    [],
  );

  useEffect(() => {
    const playWhenReady = (event: MessageEvent<unknown>) => {
      if (!playerAdapter.isReadyMessage(event)) return;
      playerAdapter.play({ unmute: !requiresSoundGesture });
    };
    window.addEventListener('message', playWhenReady);
    return () => window.removeEventListener('message', playWhenReady);
  }, [playerAdapter, requiresSoundGesture]);

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
            playerAdapter.play({ unmute: true });
            setShowSoundPrompt(false);
          }}
        >
          {t('preview.sound')}
        </button>
      ) : null}
    </div>
  );
}
