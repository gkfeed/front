import { useDeferredValue, useMemo, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { filterFeeds } from '../features/feeds/feedsListViewModel';
import type { Feed } from '../types';
import { FeedCard } from './FeedCard';

const SEARCH_DEBOUNCE_MS = 80;
const SKELETON_ITEMS = [1, 2, 3] as const;

export type FeedsListModel = {
  feeds: Feed[];
  errorMessage: string;
  isLoading: boolean;
  retry: () => void;
};

export function FeedsList({ model }: { model: FeedsListModel }) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [draftSearchTerm, setDraftSearchTerm] = useState(searchTerm);
  const [, startSearchTransition] = useTransition();
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const settledSearchTerm = useDebouncedValue(deferredSearchTerm, SEARCH_DEBOUNCE_MS);
  const { feeds, errorMessage, isLoading, retry } = model;
  const displayQuery = settledSearchTerm.trim();
  const normalizedQuery = displayQuery.toLowerCase();
  const filteredFeeds = useMemo(() => filterFeeds(feeds, normalizedQuery), [feeds, normalizedQuery]);
  const resultsAnnouncement = isLoading
    ? t('feed.loadingPeriod')
    : getResultsAnnouncement(filteredFeeds.length, displayQuery, t);

  return (
    <div className="feeds-page">
      <label className="feed-search">
        <span className="sr-only">{t('feed.search')}</span>
        <svg className="feed-search__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="m20 20-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
        </svg>
        <input
          className="feed-search__input"
          type="search"
          placeholder={t('feed.search')}
          aria-label={t('feed.search')}
          value={draftSearchTerm}
          onChange={(event) => {
            const nextSearchTerm = event.target.value;
            setDraftSearchTerm(nextSearchTerm);
            startSearchTransition(() => setSearchTerm(nextSearchTerm));
          }}
        />
      </label>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {resultsAnnouncement}
      </p>
      {isLoading ? (
        <div className="feeds-loading" role="status" aria-live="polite" aria-label={t('feed.loading')}>
          {SKELETON_ITEMS.map((item) => (
            <div key={item} className="feed-skeleton" aria-hidden="true">
              <span className="feed-skeleton__line feed-skeleton__line--title" />
              <span className="feed-skeleton__line" />
              <span className="feed-skeleton__line feed-skeleton__line--url" />
            </div>
          ))}
          <span className="sr-only">{t('feed.loading')}...</span>
        </div>
      ) : errorMessage ? (
        <div className="feeds-empty">
          <span role="alert">{errorMessage}</span>
          <button type="button" className="ui-button--secondary" onClick={retry}>{t('live.tryAgain')}</button>
        </div>
      ) : filteredFeeds.length ? (
        filteredFeeds.map((feed) => <FeedCard key={feed.id} feed={feed} />)
      ) : (
        <p className="feeds-empty">
          {normalizedQuery
            ? t('feed.noMatching')
            : <>{t('feed.noFeeds')} <Link to="/create">{t('feed.createOne')}</Link>.</>}
        </p>
      )}
    </div>
  );
}

function getResultsAnnouncement(count: number, query: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!query) return t('feed.showing', { count });
  if (count === 0) return t('feed.noResults', { query });
  return t('feed.found', { count, query });
}
