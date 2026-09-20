import { useCallback, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { TheaterPlayerShell } from './TheaterPlayerShell';
import { YoutubeComments } from './YoutubeComments';
import { useYoutubePlayerController } from './useYoutubePlayerController';
import { sendPlaybackRate } from './youtubePlayerProtocol';

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

export function YoutubePlayer(props: YoutubePlayerProps) {
  const [isPlayerUnavailable, setIsPlayerUnavailable] = useState(false);
  const markPlayerUnavailable = useCallback(() => setIsPlayerUnavailable(true), []);
  const { iframeRef } = useYoutubePlayerController({
    isDoubleSpeed: props.isDoubleSpeed,
    onPlaybackStateChange: props.onPlaybackStateChange,
    onPlayerUnavailable: markPlayerUnavailable,
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
      isPlayerUnavailable={isPlayerUnavailable}
      onTogglePlaybackSpeed={togglePlaybackSpeed}
    />
  );
}

type YoutubePlayerViewProps = YoutubePlayerProps & {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  isPlayerUnavailable?: boolean;
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
  isPlayerUnavailable = false,
}: YoutubePlayerViewProps) {
  const { t } = useTranslation();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const parameters = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    enablejsapi: '1',
  });
  if (resumePosition !== null) {
    parameters.set('start', String(Math.floor(resumePosition)));
  }

  return (
    <TheaterPlayerShell
      title={title || t('preview.youtubePlayer')}
      isTheaterOpen={isTheaterOpen}
      onToggleTheater={onToggleTheater}
      shellRef={shellRef}
      aside={!isPlayerUnavailable && isCommentsOpen
        ? <YoutubeComments videoId={videoId} isOpen />
        : undefined}
      toolbar={!isPlayerUnavailable ? (
        <>
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
            className="reader-card__comments-toggle"
            aria-label={isCommentsOpen ? t('youtubeComments.hide') : t('youtubeComments.show')}
            aria-pressed={isCommentsOpen}
            aria-controls={`youtube-comments-${videoId}`}
            onClick={() => setIsCommentsOpen((value) => !value)}
          >
            <span aria-hidden="true">☰</span>
            {t('youtubeComments.comments')}
          </button>
        </>
      ) : undefined}
    >
      {isPlayerUnavailable ? (
        <div className="reader-card__media-error" role="alert">
          <strong>{t('preview.youtubeEmbedUnavailable')}</strong>
          <span>{t('preview.youtubeEmbedError')}</span>
          <a
            href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`}
            target="_blank"
            rel="noreferrer"
          >
            {t('preview.watchOnYoutube')} <span aria-hidden="true">↗</span>
          </a>
        </div>
      ) : (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${parameters}`}
          title={title || t('preview.youtubePlayer')}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          ref={iframeRef}
        />
      )}
    </TheaterPlayerShell>
  );
}
