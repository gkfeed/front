import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { useYoutubePreviewSession } from './useYoutubePreviewSession';
import { YoutubePlayer } from './YoutubePlayer';

export type YoutubePreviewProps = {
  onPreviewError: () => void;
  preview: LocalizedFeedItemPreview | null;
  title: string;
  videoId: string;
};

export function YoutubePreview({
  onPreviewError,
  preview,
  title,
  videoId,
}: YoutubePreviewProps) {
  const { t } = useTranslation();
  const session = useYoutubePreviewSession(videoId);

  if (session.isPlayerOpen) {
    return (
      <YoutubePlayer
        videoId={videoId}
        title={title}
        isTheaterOpen={session.isTheaterOpen}
        isDoubleSpeed={session.isDoubleSpeed}
        resumePosition={session.resumePosition}
        shellRef={session.playerRef}
        onPlaybackStateChange={session.handlePlaybackChange}
        onToggleTheater={session.toggleTheater}
        onTogglePlaybackSpeed={session.togglePlaybackSpeed}
      />
    );
  }

  return (
    <div className="reader-card__preview-trigger-wrap">
      <button
        type="button"
        ref={session.triggerRef}
        className="reader-card__preview-trigger"
        aria-label={t('preview.playVideo', { title })}
        onClick={session.openPlayer}
      />
      {preview ? (
        <div className="reader-card__preview">
          <img
            src={preview.src}
            alt={preview.alt}
            referrerPolicy="no-referrer"
            onLoad={(event) => {
              if (isYoutubeMissingThumbnail(event.currentTarget)) onPreviewError();
            }}
            onError={onPreviewError}
          />
        </div>
      ) : null}
    </div>
  );
}

export { YoutubePlayerView } from './YoutubePlayer';

function isYoutubeMissingThumbnail(image: HTMLImageElement): boolean {
  if (image.naturalWidth !== 120 || image.naturalHeight !== 90) return false;
  try {
    const url = new URL(image.src, window.location.href);
    return !url.pathname.endsWith('/default.jpg');
  } catch {
    return !image.src.endsWith('/default.jpg');
  }
}
