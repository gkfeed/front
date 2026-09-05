import type { TikTokPlaybackPreview } from '../../../../shared/tiktokContracts';
import { TikTokAuthorOverlay } from './TikTokAuthorOverlay';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SoundGestureLifecycle } from '../../hooks/useSoundGesture';
import { fetchTikTokPlayback } from '../../services/tiktokPlayback';
import { FeedItemVideoMedia } from './FeedItemVideoMedia';
import { TikTokEmbed } from './TikTokEmbed';

export function TikTokPreview(props: {
  href: string;
  src: string;
  title: string;
  soundGesture: SoundGestureLifecycle;
}) {
  // Remount on post changes so late requests and player state cannot affect the next post.
  return <TikTokPreviewPlayer key={props.href} {...props} />;
}

function TikTokPreviewPlayer({ href, src, title, soundGesture }: {
  href: string;
  src: string;
  title: string;
  soundGesture: SoundGestureLifecycle;
}) {
  const { t } = useTranslation();
  const [playback, setPlayback] = useState<TikTokPlaybackPreview | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetchTikTokPlayback(href, controller.signal).then((result) => {
      if (!controller.signal.aborted) setPlayback(result);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [href]);

  if (failed) return <TikTokEmbed src={src} title={title} soundGesture={soundGesture} />;
  if (!playback) return (
    <div className="reader-card__preview reader-card__preview--short-video reader-card__preview--tiktok" role="status">
      {t('preview.loadingVideo')}
    </div>
  );
  return (
    <FeedItemVideoMedia
      key={playback.videoUrl}
      preview={{ type: 'video', src: playback.videoUrl, alt: title }}
      overlay={playback.author ? <TikTokAuthorOverlay author={playback.author} /> : undefined}
      soundGesture={soundGesture}
      isShortVideo
      isTikTok
      onPreviewError={() => setFailed(true)}
    />
  );
}
