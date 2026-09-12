import { useTranslation } from 'react-i18next';

import '../../styles/live-stream-preview.css';
import { getTwitchChannelUrl, getTwitchEmbedUrl } from '../domain/twitchEmbed';
import type { LiveStreamViewModel } from '../features/live/liveViewModel';

export type LiveStreamPreviewProps = {
  stream: LiveStreamViewModel;
  isPlaying: boolean;
  onPlay: () => void;
};

export function LiveStreamPreview({ stream, isPlaying, onPlay }: LiveStreamPreviewProps) {
  const { t } = useTranslation();
  const { channel, preview } = stream;
  const embedUrl = getTwitchEmbedUrl(channel);

  if (isPlaying && embedUrl) {
    return (
      <div className="live-preview live-preview--player">
        <iframe
          src={embedUrl}
          title={t('live.playerTitle', { channel })}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  const previewContent = (
    <>
      {preview ? <img src={preview.src} alt={t('live.previewAlt', { channel })} /> : null}
      <span className="live-preview__play" aria-hidden="true">▶</span>
    </>
  );

  return embedUrl ? (
    <button
      type="button"
      className="live-preview live-preview--trigger"
      aria-label={t('live.playOn', { channel })}
      onClick={onPlay}
    >
      {previewContent}
    </button>
  ) : (
    <a
      className="live-preview live-preview--trigger"
      href={getTwitchChannelUrl(channel)}
      target="_blank"
      rel="noreferrer"
      aria-label={t('live.playOn', { channel })}
    >
      {previewContent}
    </a>
  );
}
