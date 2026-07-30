import { memo } from 'react';
import { Link } from 'react-router';

import type { Feed } from '../types';
import { getFeedIcon } from './feedIcons';

function FeedContent({ feed, actionCopy }: { feed: Feed; actionCopy: string }) {
  const feedIcon = getFeedIcon(feed);
  return (
    <>
      <span className="feed__type-logo" role="img" aria-label={feedIcon.label}>
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <path d={feedIcon.path} fill="currentColor" />
        </svg>
      </span>
      <span className="feed__topline">
        <strong className="feed__title">{feed.title}</strong>
        <span className="feed__meta"><span className="feed__id">#{feed.id}</span></span>
      </span>
      <span className="feed__url">{feed.url}</span>
      <span className="feed__action">
        <span className="feed__action-copy">{actionCopy}</span>
        <span className="feed__action-hint">source record</span>
      </span>
    </>
  );
}

export const FeedCard = memo(function FeedCard({ feed, asLink = true }: { feed: Feed; asLink?: boolean }) {
  return asLink ? (
    <Link className="feed" to={`/feed/${feed.id}`} aria-label={`Open feed ${feed.title}`}>
      <FeedContent feed={feed} actionCopy="Open details" />
    </Link>
  ) : (
    <article className="feed">
      <FeedContent feed={feed} actionCopy="Feed details" />
    </article>
  );
});
