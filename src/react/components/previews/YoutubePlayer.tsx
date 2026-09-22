import { useCallback, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { TheaterPlayerShell } from './TheaterPlayerShell';
import { YoutubeComments } from './YoutubeComments';
import { YoutubeTimecodes } from './YoutubeTimecodes';
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
  const { currentTime, iframeRef, seekTo } = useYoutubePlayerController({
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
      currentTime={currentTime}
      isPlayerUnavailable={isPlayerUnavailable}
      onSeek={seekTo}
      onTogglePlaybackSpeed={togglePlaybackSpeed}
    />
  );
}

type YoutubePlayerViewProps = YoutubePlayerProps & {
  currentTime?: number;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  isPlayerUnavailable?: boolean;
  onSeek?: (seconds: number) => void;
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
  currentTime = 0,
  isPlayerUnavailable = false,
  onSeek = () => {},
}: YoutubePlayerViewProps) {
  const { t } = useTranslation();
  const [openPanel, setOpenPanel] = useState<'comments' | 'timecodes' | null>(null);
  const isCommentsOpen = openPanel === 'comments';
  const isTimecodesOpen = openPanel === 'timecodes';
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
        : !isPlayerUnavailable && isTimecodesOpen
          ? <YoutubeTimecodes currentTime={currentTime} videoId={videoId} onSeek={onSeek} />
          : undefined}
      toolbar={!isPlayerUnavailable ? (
        <>
          <button
            type="button"
            className="reader-card__timecodes-toggle"
            aria-label={isTimecodesOpen ? t('youtubeTimecodes.hide') : t('youtubeTimecodes.show')}
            aria-pressed={isTimecodesOpen}
            aria-controls={`youtube-timecodes-${videoId}`}
            onClick={() => setOpenPanel((panel) => panel === 'timecodes' ? null : 'timecodes')}
          >
            <span aria-hidden="true">⌁</span>
            {t('youtubeTimecodes.timecodes')}
          </button>
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
            onClick={() => setOpenPanel((panel) => panel === 'comments' ? null : 'comments')}
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
