import { useCallback, useDeferredValue, useMemo, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useAsyncLoad } from '../hooks/useAsyncLoad';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getAllFeeds } from '../services/feeds';
import { getRequestErrorMessage } from '../services/authError';
import { useAuth } from '../state/useAuth';
import type { Credentials, Feed } from '../types';
import { FeedCard } from './FeedCard';

const SEARCH_DEBOUNCE_MS = 80;
const SKELETON_ITEMS = [1, 2, 3] as const;

export function FeedsList() {
  const { t } = useTranslation();
  const { credentials } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [draftSearchTerm, setDraftSearchTerm] = useState(searchTerm);
  const [, startSearchTransition] = useTransition();
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const settledSearchTerm = useDebouncedValue(deferredSearchTerm, SEARCH_DEBOUNCE_MS);
  const { feeds, errorMessage, isLoading, retry } = useFeeds(credentials);
  const displayQuery = settledSearchTerm.trim();
  const normalizedQuery = displayQuery.toLowerCase();
  const filteredFeeds = useMemo(() => filterFeeds(feeds, normalizedQuery), [feeds, normalizedQuery]);
  const resultsAnnouncement = isLoading
    ? t('feed.loadingPeriod')
    : getResultsAnnouncement(filteredFeeds.length, displayQuery, t);

  return (
    <div className="container">
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
        <div className="loading" role="status" aria-live="polite" aria-label={t('feed.loading')}>
          {SKELETON_ITEMS.map((item) => (
            <div key={item} className="feed-skeleton" aria-hidden="true">
              <span className="skeleton-line skeleton-title" />
              <span className="skeleton-line" />
              <span className="skeleton-line skeleton-url" />
            </div>
          ))}
          <span className="sr-only">{t('feed.loading')}...</span>
        </div>
      ) : errorMessage ? (
        <div className="empty">
          <span role="alert">{errorMessage}</span>
          <button type="button" className="secondary" onClick={retry}>{t('live.tryAgain')}</button>
        </div>
      ) : filteredFeeds.length ? (
        filteredFeeds.map((feed) => <FeedCard key={feed.id} feed={feed} />)
      ) : (
        <p className="empty">
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

function useFeeds(credentials: Credentials | null) {
  const { t } = useTranslation();
  const load = useCallback((signal: AbortSignal) => getAllFeeds(credentials, signal), [credentials]);
  const { result: feeds = [], error, isLoading, retry } = useAsyncLoad(load);

  return {
    feeds,
    errorMessage: error ? getRequestErrorMessage(error, t, 'feed.unableConnection') : '',
    isLoading,
    retry,
  };
}

function filterFeeds(feeds: Feed[], normalizedQuery: string): Feed[] {
  if (!normalizedQuery) return feeds;

  return feeds.filter((feed) => (
    `${feed.title} ${feed.type} ${feed.url}`.toLowerCase().includes(normalizedQuery)
  ));
}
