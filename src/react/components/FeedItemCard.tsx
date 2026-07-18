import { useState } from 'react';

import type { FeedItem } from '../types';
import { getFeedItemPreview, isYoutubeFeedItem } from './feedItemPreview';

export function FeedItemCard({ item }: { item: FeedItem }) {
  const hostname = getHostname(item.link);
  const preview = getFeedItemPreview(item);
  const isYoutube = isYoutubeFeedItem(item);
  const [previewFailed, setPreviewFailed] = useState(false);

  return (
    <article className={`reader-card${isYoutube ? ' reader-card--youtube' : ''}`}>
      {preview && !previewFailed ? (
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
          {item.text ? <p className="reader-card__text">{item.text}</p> : null}
          <a className="reader-card__link" href={item.link} target="_blank" rel="noreferrer">
            Read original <span aria-hidden="true">↗</span>
          </a>
        </>
      )}
    </article>
  );
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
