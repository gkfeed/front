import { useTranslation } from 'react-i18next';

import type { LiveStreamViewModel } from '../features/live/liveViewModel';

export type LiveStreamPreviewProps = {
  stream: LiveStreamViewModel;
  isPlaying: boolean;
  onPlay: () => void;
};

export function LiveStreamPreview({ stream, isPlaying, onPlay }: LiveStreamPreviewProps) {
  const { t } = useTranslation();
  const { channel, preview } = stream;

  if (isPlaying) {
    const parameters = new URLSearchParams({
      channel,
      parent: window.location.hostname || 'localhost',
      autoplay: 'true',
    });

    return (
      <div className="live__preview live__preview--player">
        <iframe
          src={`https://player.twitch.tv/?${parameters}`}
          title={t('live.playerTitle', { channel })}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="live__preview live__preview-trigger"
      aria-label={t('live.playOn', { channel })}
      onClick={onPlay}
    >
      {preview ? <img src={preview.src} alt={t('live.previewAlt', { channel })} /> : null}
      <span className="live__play" aria-hidden="true">▶</span>
    </button>
  );
}
