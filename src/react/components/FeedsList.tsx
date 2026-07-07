import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getAllFeeds } from '../services/feeds';
import { useAuth } from '../state/AuthContext';
import { useFeedSearch } from '../state/FeedSearchContext';
import type { Feed } from '../types';
import { FeedCard } from './FeedCard';

export function FeedsList() {
  const { credentials } = useAuth();
  const { searchTerm } = useFeedSearch();
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const settledSearchTerm = useDebouncedValue(deferredSearchTerm, 80);
  const [result, setResult] = useState<{ feeds: Feed[]; errorMessage?: string }>();
  const [attempt, setAttempt] = useState(0);
  const { feeds = [], errorMessage = '' } = result ?? {};
  const isLoading = !result;

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
  }, [attempt, credentials]);

  const indexedFeeds = useMemo(
    () => feeds.map((feed) => ({
      feed,
      searchableText: `${feed.title} ${feed.type} ${feed.url}`.toLowerCase(),
    })),
    [feeds],
  );
  const query = settledSearchTerm.trim().toLowerCase();
  const filteredFeeds = useMemo(
    () => (query ? indexedFeeds.filter(({ searchableText }) => searchableText.includes(query)).map(({ feed }) => feed) : feeds),
    [feeds, indexedFeeds, query],
  );
  const resultsAnnouncement = isLoading ? 'Loading feeds.' : getResultsAnnouncement(filteredFeeds.length, settledSearchTerm.trim());

  return (
    <div className="container">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {resultsAnnouncement}
      </p>
      {isLoading ? (
        <div className="loading" role="status" aria-live="polite" aria-label="Loading feeds">
          {[1, 2, 3].map((item) => (
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
          <button type="button" className="secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
        </div>
      ) : filteredFeeds.length ? (
        filteredFeeds.map((feed) => <FeedCard key={feed.id} feed={feed} />)
      ) : (
        <p className="empty">
          {query ? 'No matching feeds.' : <>No feeds yet. <Link to="/create">Create one</Link>.</>}
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

function useDebouncedValue(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

function getLoadErrorMessage(error: unknown): string {
  return error instanceof Error && 'status' in error && error.status === 401
    ? 'Unable to load feeds. Log in and try again.'
    : 'Unable to load feeds. Check your connection and try again.';
}
