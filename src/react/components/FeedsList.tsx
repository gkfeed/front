import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getAllFeeds } from '../services/feeds';
import { useAuth } from '../state/AuthContext';
import { useFeedSearch } from '../state/FeedSearchContext';
import type { Credentials, Feed } from '../types';
import { FeedCard } from './FeedCard';

const SEARCH_DEBOUNCE_MS = 80;
const SKELETON_ITEMS = [1, 2, 3] as const;

interface FeedLoadResult {
  feeds: Feed[];
  errorMessage?: string;
}

export function FeedsList() {
  const { credentials } = useAuth();
  const { searchTerm } = useFeedSearch();
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const settledSearchTerm = useDebouncedValue(deferredSearchTerm, SEARCH_DEBOUNCE_MS);
  const { feeds, errorMessage, isLoading, retry } = useFeeds(credentials);
  const displayQuery = settledSearchTerm.trim();
  const normalizedQuery = displayQuery.toLowerCase();
  const filteredFeeds = useMemo(() => filterFeeds(feeds, normalizedQuery), [feeds, normalizedQuery]);
  const resultsAnnouncement = isLoading ? 'Loading feeds.' : getResultsAnnouncement(filteredFeeds.length, displayQuery);

  return (
    <div className="container">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {resultsAnnouncement}
      </p>
      {isLoading ? (
        <div className="loading" role="status" aria-live="polite" aria-label="Loading feeds">
          {SKELETON_ITEMS.map((item) => (
            <div key={item} className="feed-skeleton" aria-hidden="true">
              <span className="skeleton-line skeleton-title" />
              <span className="skeleton-line" />
              <span className="skeleton-line skeleton-url" />
            </div>
          ))}
          <span className="sr-only">Loading feeds...</span>
        </div>
      ) : errorMessage ? (
        <div className="empty">
          <span role="alert">{errorMessage}</span>
          <button type="button" className="secondary" onClick={retry}>Try again</button>
        </div>
      ) : filteredFeeds.length ? (
        filteredFeeds.map((feed) => <FeedCard key={feed.id} feed={feed} />)
      ) : (
        <p className="empty">
          {normalizedQuery ? 'No matching feeds.' : <>No feeds yet. <Link to="/create">Create one</Link>.</>}
        </p>
      )}
    </div>
  );
}

function getResultsAnnouncement(count: number, query = ''): string {
  const feedLabel = count === 1 ? 'feed' : 'feeds';

  if (!query) return `Showing ${count} ${feedLabel}.`;

  return count === 0
    ? `No feeds found for search term ${query}.`
    : `${count} ${feedLabel} found for search term ${query}.`;
}

function useFeeds(credentials: Credentials | null) {
  const [result, setResult] = useState<FeedLoadResult>();
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;
    setResult(undefined);

    getAllFeeds(credentials)
      .then((nextFeeds) => {
        if (isActive) setResult({ feeds: nextFeeds });
      })
      .catch((error: unknown) => {
        if (isActive) setResult({ feeds: [], errorMessage: getLoadErrorMessage(error) });
      });

    return () => {
      isActive = false;
    };
  }, [loadAttempt, credentials]);

  const retry = useCallback(() => setLoadAttempt((value) => value + 1), []);
  const { feeds = [], errorMessage = '' } = result ?? {};

  return {
    feeds,
    errorMessage,
    isLoading: !result,
    retry,
  };
}

function filterFeeds(feeds: Feed[], normalizedQuery: string): Feed[] {
  if (!normalizedQuery) return feeds;

  return feeds.filter((feed) => (
    `${feed.title} ${feed.type} ${feed.url}`.toLowerCase().includes(normalizedQuery)
  ));
}

function getLoadErrorMessage(error: unknown): string {
  return error instanceof Error && 'status' in error && error.status === 401
    ? 'Unable to load feeds. Log in and try again.'
    : 'Unable to load feeds. Check your connection and try again.';
}
