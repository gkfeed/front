import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';

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
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isTheaterOpen, setIsTheaterOpen] = useState(false);

  useEffect(() => {
    setIsPlayerOpen(false);
    setIsTheaterOpen(false);
  }, [videoId]);

  useEffect(() => {
    if (!isTheaterOpen) return;
    document.documentElement.classList.add('reader-theater-open');

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsTheaterOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.documentElement.classList.remove('reader-theater-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTheaterOpen]);

  if (isPlayerOpen) {
    return (
      <YoutubePlayer
        videoId={videoId}
        title={title}
        isTheaterOpen={isTheaterOpen}
        onToggleTheater={() => setIsTheaterOpen((isOpen) => !isOpen)}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        className="reader-card__youtube-trigger"
        aria-label={t('preview.playVideo', { title })}
        onClick={() => {
          setIsPlayerOpen(true);
          setIsTheaterOpen(true);
        }}
      />
      {preview ? (
        <div className="reader-card__preview">
          <img
            src={preview.src}
            alt={preview.alt}
            referrerPolicy="no-referrer"
            onError={onPreviewError}
          />
        </div>
      ) : null}
    </>
  );
}

type YoutubePlayerProps = {
  videoId: string;
  title: string;
  isTheaterOpen: boolean;
  onToggleTheater: () => void;
};

function YoutubePlayer({ videoId, title, isTheaterOpen, onToggleTheater }: YoutubePlayerProps) {
  const { t } = useTranslation();
  const parameters = new URLSearchParams({ autoplay: '1', rel: '0' });

  return (
    <div className={[
      'reader-card__youtube-player-shell',
      isTheaterOpen ? 'reader-card__youtube-player-shell--theater' : '',
    ].filter(Boolean).join(' ')}>
      <div className="reader-card__youtube-player-stage">
        <div className="reader-card__youtube-player-toolbar">
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
        <div className="reader-card__preview reader-card__preview--youtube-player">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${parameters}`}
            title={title || t('preview.youtubePlayer')}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </div>
  );
}
