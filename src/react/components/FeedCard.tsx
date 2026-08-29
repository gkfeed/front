import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import '../../styles/feed-card.css';
import type { Feed } from '../types';
import { getFeedIcon } from './feedIcons';

function FeedContent({ feed, actionCopyKey }: { feed: Feed; actionCopyKey: 'feed.openDetails' | 'feed.details' }) {
  const { t } = useTranslation();
  const feedIcon = getFeedIcon(feed);
  return (
    <>
      <span
        className="feed__type-logo"
        role="img"
        aria-label={t('feed.typeIcon', { type: feedIcon.label.replace(/ feed type$/, '') })}
      >
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
        <span className="feed__action-copy">{t(actionCopyKey)}</span>
        <span className="feed__action-hint">{t('feed.sourceRecord')}</span>
      </span>
    </>
  );
}

export const FeedCard = memo(function FeedCard({ feed, asLink = true }: { feed: Feed; asLink?: boolean }) {
  const { t } = useTranslation();

  return asLink ? (
    <Link className="feed" to={`/feed/${feed.id}`} aria-label={t('feed.open', { title: feed.title })}>
      <FeedContent feed={feed} actionCopyKey="feed.openDetails" />
    </Link>
  ) : (
    <article className="feed">
      <FeedContent feed={feed} actionCopyKey="feed.details" />
    </article>
  );
});
