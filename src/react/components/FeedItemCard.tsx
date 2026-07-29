import { useEffect, useRef, useState, type CSSProperties } from 'react';

import type { OpenGraphPreview } from '../services/openGraph';
import { useFeedItemRemotePreview } from '../hooks/useFeedItemRemotePreview';
import type { FeedItem } from '../types';
import {
  getFeedItemPreview,
  getFeedItemProvider,
  getYoutubeVideoId,
  type FeedItemPreview,
} from './feedItemPreview';
import { InstagramIcon } from './Icons';
import { LiquipediaMatch } from './previews/LiquipediaMatch';
import { TikTokComments } from './previews/TikTokComments';
import { TikTokEmbed } from './previews/TikTokEmbed';
import { YoutubePreview } from './previews/YoutubePreview';

export function FeedItemCard({ item }: { item: FeedItem }) {
  const hostname = getHostname(item.link);
  const itemUrl = parseUrl(item.link);
  const youtubeVideoId = itemUrl ? getYoutubeVideoId(itemUrl) : null;
  const localPreview = getFeedItemPreview(item);
  const localPreviewSource = localPreview?.src;
  const provider = getFeedItemProvider(item);
  const isYoutube = provider === 'youtube';
  const isTikTok = provider === 'tiktok';
  const isInstagram = provider === 'instagram';
  const isShortVideo = isTikTok || isInstagram;
  const isReddit = isRedditUrl(itemUrl);
  const isVk = provider === 'vk';
  const isHltv = provider === 'hltv';
  const isLiquipedia = provider === 'liquipedia';
  const feedDescription = isVk ? getFeedItemDescription(item.text, item.title) : null;
  const shouldLoadRemotePreview = !isTikTok && !(localPreviewSource && (!isVk || feedDescription));
  const { cardRef, openGraphPreview, liquipediaMatch } = useFeedItemRemotePreview(
    item.link,
    shouldLoadRemotePreview,
    isLiquipedia,
  );
  const remotePreview = getRemotePreview(openGraphPreview, item.title);
  const description = isVk
    ? feedDescription ??
      getFeedItemDescription(openGraphPreview?.description ?? '', item.title)
    : null;
  const requiresSoundGesture = isAppleMobileDevice();
  const tiktokEmbedPreview = isTikTok ? getTikTokEmbedPreview(item) : null;
  const preview = isTikTok
    ? tiktokEmbedPreview ?? localPreview
    : localPreview ?? remotePreview;
  const [previewFailures, setPreviewFailures] = useState(0);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [showSoundPrompt, setShowSoundPrompt] = useState(requiresSoundGesture);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackSource = preview && 'fallbackSrc' in preview && typeof preview.fallbackSrc === 'string'
    ? preview.fallbackSrc
    : null;
  const fallbackPreview: FeedItemPreview | null = preview && fallbackSource
    ? { src: fallbackSource, alt: preview.alt }
    : null;
  const visiblePreview = liquipediaMatch ? null : previewFailures === 1 && preview?.type === 'video'
    ? tiktokEmbedPreview ?? (preview.poster ? { src: preview.poster, alt: preview.alt } : null)
    : previewFailures === 1 && fallbackPreview
      ? fallbackPreview
    : previewFailures > 0 ? null : preview;
  const isInstagramPhoto = isInstagram && visiblePreview?.type === undefined;
  const isImagePreviewOnly = Boolean(
    visiblePreview &&
    visiblePreview.type === undefined &&
    (
      visiblePreview.src.startsWith('/api/bff/reddit-preview-image?') ||
      (isHltv && visiblePreview.src === remotePreview?.src)
    ),
  );

  useEffect(() => {
    setPreviewFailures(0);
    setVideoAspectRatio(null);
    setShowSoundPrompt(requiresSoundGesture);
  }, [item.link, requiresSoundGesture]);

  return (
    <article
      ref={cardRef}
      className={[
        'reader-card',
        isLiquipedia ? 'reader-card--liquipedia' : '',
        isYoutube ? 'reader-card--youtube' : '',
        isShortVideo ? 'reader-card--short-video' : '',
        isTikTok ? 'reader-card--tiktok' : '',
        isInstagram ? 'reader-card--instagram' : '',
        isInstagramPhoto ? 'reader-card--instagram-photo' : '',
        isImagePreviewOnly ? 'reader-card--image-preview' : '',
        isImagePreviewOnly && isReddit ? 'reader-card--reddit-preview' : '',
      ].filter(Boolean).join(' ')}
    >
      {isInstagram ? (
        <div className="reader-card__short-video-identity">
          <span className="reader-card__short-video-logo"><InstagramIcon /></span>
          <span>{getInstagramUsername(item.title)}</span>
        </div>
      ) : null}
      {isYoutube && youtubeVideoId ? (
        <YoutubePreview
          videoId={youtubeVideoId}
          title={item.text || item.title}
          preview={visiblePreview}
          onPreviewError={() => setPreviewFailures((failures) => failures + 1)}
        />
      ) : liquipediaMatch ? (
        <LiquipediaMatch match={liquipediaMatch} />
      ) : visiblePreview ? visiblePreview.type === 'video' ? (
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
            key={visiblePreview.src}
            src={visiblePreview.src}
            poster={visiblePreview.poster}
            aria-label={visiblePreview.alt}
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
            onError={() => setPreviewFailures((failures) => failures + 1)}
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
      ) : visiblePreview.type === 'embed' ? (
        <TikTokEmbed
          src={visiblePreview.src}
          title={visiblePreview.alt}
          requiresSoundGesture={requiresSoundGesture}
        />
      ) : (
        <a
          className={[
            'reader-card__preview',
            isShortVideo ? 'reader-card__preview--short-video' : '',
            isTikTok ? 'reader-card__preview--tiktok' : '',
          ].filter(Boolean).join(' ')}
          href={item.link}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${item.title || hostname}`}
        >
          <img
            src={visiblePreview.src}
            alt={visiblePreview.alt}
            referrerPolicy="no-referrer"
            onError={() => setPreviewFailures((failures) => failures + 1)}
          />
        </a>
      ) : null}
      {isTikTok ? <TikTokComments item={item} /> : null}
      {isImagePreviewOnly ? null : isYoutube ? (
        <div className="reader-card__youtube-copy">
          <h2 className="reader-card__title">{item.text || item.title}</h2>
          <p className="reader-card__channel">{getYoutubeChannelName(item.title)}</p>
        </div>
      ) : isShortVideo ? null : (
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

function getTikTokEmbedPreview(item: FeedItem): FeedItemPreview | null {
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

function isAppleMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iP(?:hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function getRemotePreview(
  preview: OpenGraphPreview | null,
  title: string,
): FeedItemPreview | null {
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

function getInstagramUsername(title: string): string {
  return title.replace(/^inst:\s*/i, '').trim() || 'Instagram';
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

function isRedditUrl(url: URL | null): boolean {
  if (!url) return false;
  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  return hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
}
