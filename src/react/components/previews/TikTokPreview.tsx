import type { TikTokPlaybackPreview } from '../../../../shared/tiktokContracts';
import { TikTokAuthorOverlay } from './TikTokAuthorOverlay';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SoundGestureLifecycle } from '../../hooks/useSoundGesture';
import { BffHttpError, BffTimeoutError } from '../../services/bffClient';
import { tikTokDiagnostic } from '../../services/readerDiagnostics';
import { fetchTikTokPlayback, getCachedTikTokPlayback } from '../../services/tiktokPlayback';
import { FeedItemVideoMedia } from './FeedItemVideoMedia';
import { TikTokSlideshow } from './TikTokSlideshow';

export function TikTokPreview(props: {
  href: string;
  src: string;
  title: string;
  soundGesture: SoundGestureLifecycle;
}) {
  // Remount on post changes so late requests and player state cannot affect the next post.
  return <TikTokPreviewPlayer key={props.href} {...props} />;
}

function TikTokPreviewPlayer({ href, title, soundGesture }: {
  href: string;
  src: string;
  title: string;
  soundGesture: SoundGestureLifecycle;
}) {
  const { t } = useTranslation();
  const [initialPlayback] = useState(() => getCachedTikTokPlayback(href) ?? null);
  const [playback, setPlayback] = useState<TikTokPlaybackPreview | null>(initialPlayback);
  const [unavailable, setUnavailable] = useState(false);
  const [slow, setSlow] = useState(false);
  const username = getTikTokUsername(href);
  const author = playback?.author ?? (username ? { name: null, username, avatarUrl: null } : undefined);

  useEffect(() => {
    tikTokDiagnostic('visible-start', href);
    if (initialPlayback) {
      tikTokDiagnostic('visible-metadata-ready', href, 'cache');
      return undefined;
    }
    const controller = new AbortController();
    let retryTimer: number | undefined;
    const slowTimer = window.setTimeout(() => {
      tikTokDiagnostic('visible-loading-slow', href);
      setSlow(true);
    }, 2_000);
    const load = (retry: boolean) => void fetchTikTokPlayback(href, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        window.clearTimeout(slowTimer);
        tikTokDiagnostic('visible-metadata-ready', href);
        setPlayback(result);
      }
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const transient = error instanceof BffTimeoutError || error instanceof TypeError
        || (error instanceof BffHttpError && (error.status === 429 || error.status >= 500));
      if (!retry && transient) {
        tikTokDiagnostic('visible-metadata-retry', href);
        retryTimer = window.setTimeout(() => load(true), 500);
      } else {
        window.clearTimeout(slowTimer);
        tikTokDiagnostic('visible-metadata-error', href);
        setUnavailable(true);
      }
    });
    load(false);
    return () => {
      controller.abort();
      window.clearTimeout(slowTimer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [href, initialPlayback]);

  if (unavailable) return (
    <div className="reader-card__preview reader-card__preview--short-video reader-card__preview--tiktok">
      <div className="reader-card__media-error" role="status">
        <strong>{t('preview.tiktokUnavailable')}</strong>
        <a href={href} target="_blank" rel="noreferrer">{t('reader.openOriginal')}</a>
      </div>
      {author ? <TikTokAuthorOverlay author={author} /> : null}
    </div>
  );
  if (!playback) return (
    <div className="reader-card__preview reader-card__preview--short-video reader-card__preview--tiktok">
      <div className="reader-card__media-error" role="status">
        <strong>{t(slow ? 'preview.videoLoadingSlow' : 'preview.loadingVideo')}</strong>
        {slow ? <a href={href} target="_blank" rel="noreferrer">{t('reader.openOriginal')}</a> : null}
      </div>
      {author ? <TikTokAuthorOverlay author={author} /> : null}
    </div>
  );
  if (playback.imageUrls) return (
    <TikTokSlideshow
      imageUrls={playback.imageUrls}
      audioUrl={playback.videoUrl}
      title={title}
      soundGesture={soundGesture}
      author={author}
      onError={() => setUnavailable(true)}
    />
  );
  return (
    <FeedItemVideoMedia
      key={playback.videoUrl}
      preview={{ type: 'video', src: playback.videoUrl, alt: title }}
      overlay={author ? <TikTokAuthorOverlay author={author} /> : undefined}
      soundGesture={soundGesture}
      diagnosticId={href}
      isShortVideo
      isTikTok
      onPreviewError={() => setUnavailable(true)}
    />
  );
}

function getTikTokUsername(href: string): string | null {
  try {
    const username = new URL(href).pathname.match(/^\/@([A-Za-z0-9._-]{1,64})(?:\/|$)/)?.[1];
    return username ?? null;
  } catch {
    return null;
  }
}
