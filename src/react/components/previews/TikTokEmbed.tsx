import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { SoundGestureLifecycle } from '../../hooks/useSoundGesture';
import { createTikTokPlayerAdapter } from './tikTokPlayerProtocol';

type TikTokEmbedProps = {
  src: string;
  title: string;
  soundGesture: SoundGestureLifecycle;
};

export function TikTokEmbed({ src, title, soundGesture }: TikTokEmbedProps) {
  const { t } = useTranslation();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const playerAdapter = useMemo(
    () => createTikTokPlayerAdapter(() => frameRef.current?.contentWindow ?? null),
    [],
  );

  useEffect(() => {
    const playWhenReady = (event: MessageEvent<unknown>) => {
      if (!playerAdapter.isReadyMessage(event)) return;
      playerAdapter.play({ unmute: !soundGesture.isMuted });
    };
    window.addEventListener('message', playWhenReady);
    return () => window.removeEventListener('message', playWhenReady);
  }, [playerAdapter, soundGesture.isMuted]);

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
      {soundGesture.showPrompt ? (
        <button
          type="button"
          className="reader-card__sound-toggle"
          onClick={() => {
            soundGesture.enableSound();
            playerAdapter.play({ unmute: true });
          }}
        >
          {t('preview.sound')}
        </button>
      ) : null}
    </div>
  );
}
