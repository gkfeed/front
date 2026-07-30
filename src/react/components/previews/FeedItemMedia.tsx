import { useEffect, useRef, useState, type CSSProperties } from 'react';

import type { FeedItemPreview } from '../../domain/feedItemPreview';
import { isAppleMobileDevice } from '../../domain/device';
import { TikTokEmbed } from './TikTokEmbed';
import { VideoEmbed } from './VideoEmbed';
import { HltvImageScore } from './HltvMatch';

type FeedItemMediaProps = {
  href: string;
  hostname: string;
  preview: FeedItemPreview;
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
  const requiresSoundGesture = isAppleMobileDevice();
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [showSoundPrompt, setShowSoundPrompt] = useState(requiresSoundGesture);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setVideoAspectRatio(null);
    setShowSoundPrompt(requiresSoundGesture);
  }, [preview.src, requiresSoundGesture]);

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
          muted={requiresSoundGesture}
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
        {showSoundPrompt ? (
          <button
            type="button"
            className="reader-card__sound-toggle"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = false;
                void videoRef.current.play();
              }
              setShowSoundPrompt(false);
            }}
          >
            Tap for sound
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
        requiresSoundGesture={requiresSoundGesture}
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
        ? `Open ${hostname}, final score ${hltvImageScore[0]} to ${hltvImageScore[1]}`
        : `Open ${hostname}`}
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
