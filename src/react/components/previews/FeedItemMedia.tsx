import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { isAppleMobileDevice } from '../../domain/device';
import { useSoundGesture } from '../../hooks/useSoundGesture';
import { TikTokEmbed } from './TikTokEmbed';
import { VideoEmbed } from './VideoEmbed';
import { HltvImageScore } from './HltvMatch';

type FeedItemMediaProps = {
  href: string;
  hostname: string;
  preview: LocalizedFeedItemPreview;
  isShortVideo: boolean;
  isTikTok: boolean;
  hltvImageScore: [string, string] | null;
  onPreviewError: () => void;
};

export function FeedItemMedia({
  href,
  hostname,
  preview,
  isShortVideo,
  isTikTok,
  hltvImageScore,
  onPreviewError,
}: FeedItemMediaProps) {
  const { t } = useTranslation();
  const requiresSoundGesture = isAppleMobileDevice();
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const soundGesture = useSoundGesture(requiresSoundGesture, preview.src);

  useEffect(() => {
    setVideoAspectRatio(null);
  }, [preview.src]);

  if (preview.type === 'video') {
    return (
      <div className={[
        'reader-card__preview',
        'reader-card__preview--video',
        videoAspectRatio ? 'reader-card__preview--video-adaptive' : '',
        isShortVideo ? 'reader-card__preview--short-video' : '',
        isTikTok ? 'reader-card__preview--tiktok' : '',
      ].filter(Boolean).join(' ')}
        style={videoAspectRatio ? {
          '--reader-video-aspect-ratio': videoAspectRatio,
          aspectRatio: videoAspectRatio,
        } as CSSProperties : undefined}
      >
        <video
          ref={videoRef}
          src={preview.src}
          poster={preview.poster}
          aria-label={preview.alt}
          autoPlay
          controls
          loop
          muted={soundGesture.isMuted}
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            const { videoHeight, videoWidth } = event.currentTarget;
            if (videoHeight > 0 && videoWidth > 0) {
              setVideoAspectRatio(videoWidth / videoHeight);
            }
          }}
          onError={onPreviewError}
        />
        {soundGesture.showPrompt ? (
          <button
            type="button"
            className="reader-card__sound-toggle"
            onClick={() => {
              soundGesture.enableSound();
              if (videoRef.current) {
                videoRef.current.muted = false;
                void videoRef.current.play();
              }
            }}
          >
            {t('preview.sound')}
          </button>
        ) : null}
      </div>
    );
  }

  if (preview.type === 'embed') {
    return isTikTok ? (
      <TikTokEmbed
        src={preview.src}
        title={preview.alt}
        soundGesture={soundGesture}
      />
    ) : (
      <VideoEmbed src={preview.src} title={preview.alt} />
    );
  }

  return (
    <a
      className={[
        'reader-card__preview',
        isShortVideo ? 'reader-card__preview--short-video' : '',
        isTikTok ? 'reader-card__preview--tiktok' : '',
      ].filter(Boolean).join(' ')}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={hltvImageScore
        ? t('preview.openScore', { hostname, first: hltvImageScore[0], second: hltvImageScore[1] })
        : t('preview.open', { hostname })}
    >
      <img
        src={preview.src}
        alt={preview.alt}
        referrerPolicy="no-referrer"
        onError={onPreviewError}
      />
      {hltvImageScore ? <HltvImageScore score={hltvImageScore} /> : null}
    </a>
  );
}
