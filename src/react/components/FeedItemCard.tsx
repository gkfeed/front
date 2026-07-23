import { useEffect, useRef, useState } from 'react';

import { getOpenGraphPreview } from '../services/openGraph';
import type { FeedItem } from '../types';
import {
  getFeedItemPreview,
  isTikTokFeedItem,
  isVkFeedItem,
  isYoutubeFeedItem,
} from './feedItemPreview';

export function FeedItemCard({ item }: { item: FeedItem }) {
  const hostname = getHostname(item.link);
  const localPreview = getFeedItemPreview(item);
  const localPreviewSource = localPreview?.src;
  const [openGraphPreview, setOpenGraphPreview] = useState<Awaited<ReturnType<typeof getOpenGraphPreview>> | null>(null);
  const isYoutube = isYoutubeFeedItem(item);
  const isTikTok = isTikTokFeedItem(item);
  const isVk = isVkFeedItem(item);
  const remotePreview = getRemotePreview(openGraphPreview, item.title);
  const feedDescription = isVk ? getFeedItemDescription(item.text, item.title) : null;
  const description = isVk
    ? feedDescription ??
      getFeedItemDescription(openGraphPreview?.description ?? '', item.title)
    : null;
  const tiktokEmbedPreview = isTikTok ? getTikTokEmbedPreview(item) : null;
  const preview = isTikTok
    ? tiktokEmbedPreview ?? localPreview
    : localPreview ?? remotePreview;
  const [previewFailures, setPreviewFailures] = useState(0);
  const visiblePreview = previewFailures === 1 && preview?.type === 'video'
    ? tiktokEmbedPreview ?? (preview.poster ? { src: preview.poster, alt: preview.alt } : null)
    : previewFailures > 0 ? null : preview;

  useEffect(() => {
    setOpenGraphPreview(null);
    setPreviewFailures(0);
    if (isTikTok || (localPreviewSource && (!isVk || feedDescription))) return;

    const controller = new AbortController();
    getOpenGraphPreview(item.link, controller.signal)
      .then(setOpenGraphPreview)
      .catch(() => undefined);

    return () => controller.abort();
  }, [feedDescription, isTikTok, isVk, item.link, localPreviewSource]);

  return (
    <article className={[
      'reader-card',
      isYoutube ? 'reader-card--youtube' : '',
      isTikTok ? 'reader-card--tiktok' : '',
    ].filter(Boolean).join(' ')}>
      {visiblePreview ? visiblePreview.type === 'video' ? (
        <div className={[
          'reader-card__preview',
          'reader-card__preview--video',
          isTikTok ? 'reader-card__preview--tiktok' : '',
        ].filter(Boolean).join(' ')}>
          <video
            key={visiblePreview.src}
            src={visiblePreview.src}
            poster={visiblePreview.poster}
            aria-label={visiblePreview.alt}
            autoPlay={isTikTok}
            controls
            loop={isTikTok}
            playsInline
            preload={isTikTok ? 'auto' : 'metadata'}
            onError={() => setPreviewFailures((failures) => failures + 1)}
          />
        </div>
      ) : visiblePreview.type === 'embed' ? (
        <TikTokEmbed src={visiblePreview.src} title={visiblePreview.alt} />
      ) : (
        <a
          className={[
            'reader-card__preview',
            isTikTok ? 'reader-card__preview--tiktok' : '',
          ].filter(Boolean).join(' ')}
          href={item.link}
          target="_blank"
          rel="noreferrer"
          aria-label={isYoutube ? `Open video ${item.text || item.title}` : `Open ${item.title || hostname}`}
        >
          <img
            src={visiblePreview.src}
            alt={visiblePreview.alt}
            referrerPolicy="no-referrer"
            onError={() => setPreviewFailures((failures) => failures + 1)}
          />
        </a>
      ) : null}
      {isYoutube ? (
        <div className="reader-card__youtube-copy">
          <h2 className="reader-card__title">{item.text || item.title}</h2>
          <p className="reader-card__channel">{getYoutubeChannelName(item.title)}</p>
        </div>
      ) : isTikTok ? null : (
        <>
          <div className="reader-card__meta">
            <span>{hostname}</span>
            <span>Feed #{item.feedId}</span>
          </div>
          <h2 className="reader-card__title">{item.title || hostname}</h2>
          {description ? <p className="reader-card__description">{description}</p> : null}
          <a className="reader-card__link" href={item.link} target="_blank" rel="noreferrer">
            Read original <span aria-hidden="true">↗</span>
          </a>
        </>
      )}
    </article>
  );
}

function getFeedItemDescription(content: string, title: string): string | null {
  if (!content) return null;

  const document = new DOMParser().parseFromString(content, 'text/html');
  document.querySelectorAll('script, style, noscript').forEach((element) => element.remove());
  const description = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (!description || description.toLocaleLowerCase() === title.trim().toLocaleLowerCase()) return null;
  return description;
}

type CardPreview = {
  src: string;
  alt: string;
  type?: 'video' | 'embed';
  poster?: string;
};

function TikTokEmbed({ src, title }: { src: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const playWhenReady = (event: MessageEvent) => {
      const playerWindow = frameRef.current?.contentWindow;
      if (event.origin !== 'https://www.tiktok.com' ||
        !playerWindow ||
        event.source !== playerWindow ||
        !isTikTokPlayerReadyMessage(event.data)) return;

      playerWindow.postMessage({ type: 'unMute', 'x-tiktok-player': true }, event.origin);
      playerWindow.postMessage({ type: 'play', 'x-tiktok-player': true }, event.origin);
    };
    window.addEventListener('message', playWhenReady);
    return () => window.removeEventListener('message', playWhenReady);
  }, []);

  return (
    <div className="reader-card__preview reader-card__preview--tiktok">
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        allow="autoplay; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

function isTikTokPlayerReadyMessage(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message['x-tiktok-player'] === true && message.type === 'onPlayerReady';
}

function getTikTokEmbedPreview(item: FeedItem): CardPreview | null {
  const url = parseUrl(item.link);
  const videoId = url?.pathname.match(/\/video\/(\d+)/)?.[1];
  if (!videoId) return null;

  const parameters = new URLSearchParams({
    autoplay: '1',
    muted: '0',
    loop: '1',
    controls: '1',
    music_info: '0',
    description: '0',
    rel: '0',
  });
  return {
    src: `https://www.tiktok.com/player/v1/${videoId}?${parameters}`,
    alt: item.title ? `Video preview for ${item.title}` : 'TikTok video preview',
    type: 'embed',
  };
}

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
