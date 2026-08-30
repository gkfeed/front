import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import {
  sendPlaybackRate,
  useYoutubePlayerController,
} from './useYoutubePlayerController';
import { useYoutubePreviewSession } from './useYoutubePreviewSession';

type YoutubePreviewProps = {
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

type YoutubePlayerProps = {
  videoId: string;
  title: string;
  isTheaterOpen: boolean;
  isDoubleSpeed: boolean;
  resumePosition: number | null;
  onPlaybackStateChange: (isPlaying: boolean) => void;
  onToggleTheater: () => void;
  onTogglePlaybackSpeed: () => void;
  shellRef: RefObject<HTMLDivElement | null>;
};

function YoutubePlayer(props: YoutubePlayerProps) {
  const { iframeRef, isResumeAvailable, resume } = useYoutubePlayerController({
    isDoubleSpeed: props.isDoubleSpeed,
    onPlaybackStateChange: props.onPlaybackStateChange,
    resumePosition: props.resumePosition,
    shellRef: props.shellRef,
    videoId: props.videoId,
  });
  const togglePlaybackSpeed = () => {
    sendPlaybackRate(iframeRef.current, props.isDoubleSpeed ? 1 : 2);
    props.onTogglePlaybackSpeed();
  };

  return (
    <YoutubePlayerView
      {...props}
      iframeRef={iframeRef}
      isResumeAvailable={isResumeAvailable}
      onResume={resume}
      onTogglePlaybackSpeed={togglePlaybackSpeed}
    />
  );
}

type YoutubePlayerViewProps = YoutubePlayerProps & {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  isResumeAvailable: boolean;
  onResume: () => void;
};

export function YoutubePlayerView({
  videoId,
  title,
  isTheaterOpen,
  isDoubleSpeed,
  resumePosition,
  onToggleTheater,
  onTogglePlaybackSpeed,
  shellRef,
  iframeRef,
  isResumeAvailable,
  onResume,
}: YoutubePlayerViewProps) {
  const { t } = useTranslation();
  const parameters = new URLSearchParams({
    autoplay: resumePosition === null ? '1' : '0',
    rel: '0',
    enablejsapi: '1',
  });

  return (
    <div
      ref={shellRef}
      className={[
        'reader-card__player-shell',
        isTheaterOpen ? 'reader-card__player-shell--theater' : '',
      ].filter(Boolean).join(' ')}
      role={isTheaterOpen ? 'dialog' : undefined}
      aria-modal={isTheaterOpen ? 'true' : undefined}
      aria-label={isTheaterOpen ? (title || t('preview.youtubePlayer')) : undefined}
    >
      <div className="reader-card__player-stage">
        <div className="reader-card__player-toolbar">
          {isResumeAvailable && resumePosition !== null ? (
            <button
              type="button"
              className="reader-card__resume-toggle"
              aria-label={t('preview.continueVideo', { position: formatYoutubeTime(resumePosition) })}
              onClick={onResume}
            >
              {t('preview.continueVideo', { position: formatYoutubeTime(resumePosition) })}
            </button>
          ) : null}
          <button
            type="button"
            className="reader-card__speed-toggle"
            aria-label={t('preview.playbackSpeed', { speed: isDoubleSpeed ? '2x' : '1x' })}
            aria-pressed={isDoubleSpeed}
            onClick={onTogglePlaybackSpeed}
          >
            {isDoubleSpeed ? '2x' : '1x'}
          </button>
          <button
            type="button"
            className="reader-card__theater-toggle"
            aria-label={isTheaterOpen ? t('preview.exitTheater') : t('preview.enterTheater')}
            aria-pressed={isTheaterOpen}
            onClick={onToggleTheater}
          >
            <span aria-hidden="true">{isTheaterOpen ? '↙' : '↗'}</span>
            {isTheaterOpen ? t('preview.exitTheaterShort') : t('preview.theater')}
          </button>
        </div>
        <div className="reader-card__preview reader-card__preview--player">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${parameters}`}
            title={title || t('preview.youtubePlayer')}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            ref={iframeRef}
          />
        </div>
      </div>
    </div>
  );
}

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
