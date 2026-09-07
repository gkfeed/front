import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TikTokPlaybackAuthor } from '../../../../shared/tiktokContracts';
import type { SoundGestureLifecycle } from '../../hooks/useSoundGesture';
import { TikTokAuthorOverlay } from './TikTokAuthorOverlay';

export function TikTokSlideshow({ imageUrls, audioUrl, title, author, soundGesture, onError }: {
  imageUrls: string[];
  audioUrl?: string;
  title: string;
  author?: TikTokPlaybackAuthor;
  soundGesture: SoundGestureLifecycle;
  onError: () => void;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const audio = useRef<HTMLAudioElement>(null);
  const move = (offset: number) => setIndex((current) =>
    (current + offset + imageUrls.length) % imageUrls.length);

  useEffect(() => {
    if (!playing || imageUrls.length < 2) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % imageUrls.length);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [playing, index, imageUrls.length]);

  return (
    <div className="reader-card__preview reader-card__preview--short-video reader-card__preview--tiktok reader-card__preview--slideshow">
      <img key={imageUrls[index]} className="reader-card__slide" src={imageUrls[index]}
        alt={title + ' (' + (index + 1) + '/' + imageUrls.length + ')'} onError={onError} />
      {author ? <TikTokAuthorOverlay author={author} /> : null}
      {imageUrls.length > 1 ? (
        <div className="reader-card__slide-controls">
          <button type="button" aria-label={t('preview.previousSlide')} onClick={() => move(-1)}>‹</button>
          <span>{index + 1} / {imageUrls.length}</span>
          <button type="button" aria-label={t(playing ? 'preview.pauseSlideshow' : 'preview.playSlideshow')}
            onClick={() => {
              setPlaying(!playing);
              if (playing) audio.current?.pause();
              else void audio.current?.play().catch(() => undefined);
            }}>{playing ? 'Ⅱ' : '▶'}</button>
          <button type="button" aria-label={t('preview.nextSlide')} onClick={() => move(1)}>›</button>
        </div>
      ) : null}
      {audioUrl ? <audio ref={audio} src={audioUrl} autoPlay loop controls
        muted={soundGesture.isMuted} aria-label={title}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : null}
      {audioUrl && soundGesture.showPrompt ? (
        <button type="button" className="reader-card__sound-toggle" onClick={() => {
          soundGesture.enableSound();
          if (audio.current) {
            audio.current.muted = false;
            if (playing) void audio.current.play().catch(() => undefined);
          }
        }}>{t('preview.sound')}</button>
      ) : null}
    </div>
  );
}
