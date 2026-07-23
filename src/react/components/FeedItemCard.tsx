import { useEffect, useState } from 'react';

import { getOpenGraphPreview } from '../services/openGraph';
import type { FeedItem } from '../types';
import { getFeedItemPreview, isYoutubeFeedItem } from './feedItemPreview';

export function FeedItemCard({ item }: { item: FeedItem }) {
  const hostname = getHostname(item.link);
  const localPreview = getFeedItemPreview(item);
  const localPreviewSource = localPreview?.src;
  const [openGraphPreview, setOpenGraphPreview] = useState<Awaited<ReturnType<typeof getOpenGraphPreview>> | null>(null);
  const preview = localPreview ?? getRemotePreview(openGraphPreview, item.title);
  const isYoutube = isYoutubeFeedItem(item);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setOpenGraphPreview(null);
    setPreviewFailed(false);
    if (localPreviewSource) return;

    const controller = new AbortController();
    getOpenGraphPreview(item.link, controller.signal)
      .then(setOpenGraphPreview)
      .catch(() => undefined);

    return () => controller.abort();
  }, [item.link, localPreviewSource]);

  return (
    <article className={`reader-card${isYoutube ? ' reader-card--youtube' : ''}`}>
      {preview && !previewFailed ? preview.type === 'video' ? (
        <div className="reader-card__preview reader-card__preview--video">
          <video
            src={preview.src}
            poster={preview.poster}
            aria-label={preview.alt}
            controls
            playsInline
            preload="metadata"
            onError={() => setPreviewFailed(true)}
          />
        </div>
      ) : (
        <a
          className="reader-card__preview"
          href={item.link}
          target="_blank"
          rel="noreferrer"
          aria-label={isYoutube ? `Open video ${item.text || item.title}` : `Open ${item.title || hostname}`}
        >
          <img
            src={preview.src}
            alt={preview.alt}
            referrerPolicy="no-referrer"
            onError={() => setPreviewFailed(true)}
          />
        </a>
      ) : null}
      {isYoutube ? (
        <div className="reader-card__youtube-copy">
          <h2 className="reader-card__title">{item.text || item.title}</h2>
          <p className="reader-card__channel">{getYoutubeChannelName(item.title)}</p>
        </div>
      ) : (
        <>
          <div className="reader-card__meta">
            <span>{hostname}</span>
            <span>Feed #{item.feedId}</span>
          </div>
          <h2 className="reader-card__title">{item.title || hostname}</h2>
          <a className="reader-card__link" href={item.link} target="_blank" rel="noreferrer">
            Read original <span aria-hidden="true">↗</span>
          </a>
        </>
      )}
    </article>
  );
}

type CardPreview = {
  src: string;
  alt: string;
  type?: 'video';
  poster?: string;
};

function getRemotePreview(
  preview: Awaited<ReturnType<typeof getOpenGraphPreview>> | null,
  title: string,
): CardPreview | null {
  if (!preview) return null;
  const altTitle = preview.title || title;

  if (preview.video && isDirectVideo(preview.video)) {
    return {
      src: preview.video,
      alt: altTitle ? `Video preview for ${altTitle}` : 'Feed item video preview',
      type: 'video',
      ...(preview.image ? { poster: preview.image } : {}),
    };
  }

  return preview.image ? {
    src: preview.image,
    alt: altTitle ? `Preview for ${altTitle}` : 'Feed item preview',
  } : null;
}

function isDirectVideo(value: string): boolean {
  return /\.(?:m4v|mov|mp4|webm)(?:$|[?#])/i.test(value);
}

function getYoutubeChannelName(title: string): string {
  return title.replace(/^YT:\s*/i, '').trim() || 'YouTube';
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getHostname(link: string): string {
  return parseUrl(link)?.hostname.replace(/^www\./, '') || 'Feed item';
}
