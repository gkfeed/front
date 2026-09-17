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
          {session.resumeProgress ? (
            <div
              className="reader-card__preview-progress"
              role="img"
              aria-label={t('preview.continueVideo', {
                position: formatYoutubeTime(session.resumeProgress.position),
              })}
            >
              <div
                className="reader-card__preview-progress-fill"
                style={{ width: `${progressPercent(session.resumeProgress)}%` }}
              />
              <span className="reader-card__preview-progress-label">
                {t('preview.continueVideo', {
                  position: formatYoutubeTime(session.resumeProgress.position),
                })}
              </span>
            </div>
          ) : null}
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

function formatYoutubeTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function progressPercent(progress: { position: number; duration: number }): number {
  if (progress.duration <= 0) return 0;
  return Math.min(100, Math.max(0, (progress.position / progress.duration) * 100));
}
