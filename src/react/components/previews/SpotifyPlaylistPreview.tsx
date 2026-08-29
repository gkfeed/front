import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isAppleMobileDevice } from '../../domain/device';
import {
  loadSpotifyIframeApi,
  type SpotifyEmbedController,
} from '../../services/spotifyIframeApi';

type SpotifyPlaylistPreviewProps = {
  embedUrl: string;
  embedHeight: 152 | 352;
  spotifyUrl: string;
  imageSrc: string;
  imageAlt: string;
  title: string;
  onPreviewError: () => void;
};

export function SpotifyPlaylistPreview({
  embedUrl,
  embedHeight,
  spotifyUrl,
  imageSrc,
  imageAlt,
  title,
  onPreviewError,
}: SpotifyPlaylistPreviewProps) {
  const { t } = useTranslation();
  const [activeEmbedUrl, setActiveEmbedUrl] = useState<string | null>(null);

  if (activeEmbedUrl === embedUrl) {
    return (
      <SpotifyEmbedPlayer
        embedUrl={embedUrl}
        embedHeight={embedHeight}
        spotifyUrl={spotifyUrl}
        title={t('preview.spotifyPlayer', { title })}
      />
    );
  }

  return (
    <button
      type="button"
      className="reader-card__preview reader-card__preview--spotify-trigger"
      aria-label={t('preview.playSpotify', { title })}
      onClick={() => setActiveEmbedUrl(embedUrl)}
    >
      <img
        src={imageSrc}
        alt={imageAlt}
        referrerPolicy="no-referrer"
        onError={onPreviewError}
      />
    </button>
  );
}

type SpotifyEmbedPlayerProps = {
  embedUrl: string;
  embedHeight: 152 | 352;
  spotifyUrl: string;
  title: string;
};

function SpotifyEmbedPlayer({
  embedUrl,
  embedHeight,
  spotifyUrl,
  title,
}: SpotifyEmbedPlayerProps) {
  const apiPlayerRef = useRef<HTMLDivElement>(null);
  const [isApiPlayerReady, setIsApiPlayerReady] = useState(false);

  useEffect(() => {
    const playerElement = apiPlayerRef.current;
    if (!playerElement || isAppleMobileDevice()) return;

    let controller: SpotifyEmbedController | null = null;
    let isDisposed = false;

    void loadSpotifyIframeApi()
      .then((api) => {
        if (isDisposed || !playerElement.isConnected) return;
        api.createController(playerElement, {
          url: spotifyUrl,
          width: '100%',
          height: embedHeight,
        }, (nextController) => {
          if (isDisposed) {
            nextController.destroy();
            return;
          }
          controller = nextController;
          nextController.play();
          setIsApiPlayerReady(true);
        });
      })
      .catch(() => {
        // The ordinary iframe remains available when the optional API is blocked.
      });

    return () => {
      isDisposed = true;
      controller?.destroy();
    };
  }, [embedHeight, spotifyUrl]);

  return (
    <div
      className="reader-card__preview reader-card__preview--spotify-player"
      style={{ height: embedHeight }}
    >
      <iframe
        src={embedUrl}
        title={title}
        height={embedHeight}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        hidden={isApiPlayerReady}
      />
      <div
        ref={apiPlayerRef}
        className="reader-card__spotify-api-player"
        hidden={!isApiPlayerReady}
      />
    </div>
  );
}
