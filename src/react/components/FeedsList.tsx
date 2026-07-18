import { useCallback, useDeferredValue, useMemo, useState, useTransition } from 'react';
import { Link } from 'react-router-dom';

import { useAsyncLoad } from '../hooks/useAsyncLoad';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getAllFeeds } from '../services/feeds';
import { useAuth } from '../state/useAuth';
import { useFeedSearch } from '../state/useFeedSearch';
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
  const { searchTerm, setSearchTerm } = useFeedSearch();
  const [draftSearchTerm, setDraftSearchTerm] = useState(searchTerm);
  const [, startSearchTransition] = useTransition();
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const settledSearchTerm = useDebouncedValue(deferredSearchTerm, SEARCH_DEBOUNCE_MS);
  const { feeds, errorMessage, isLoading, retry } = useFeeds(credentials);
  const displayQuery = settledSearchTerm.trim();
  const normalizedQuery = displayQuery.toLowerCase();
  const filteredFeeds = useMemo(() => filterFeeds(feeds, normalizedQuery), [feeds, normalizedQuery]);
  const resultsAnnouncement = isLoading ? 'Loading feeds.' : getResultsAnnouncement(filteredFeeds.length, displayQuery);

  return (
    <div className="container">
      <label className="feed-search">
        <span className="sr-only">Search feeds</span>
        <svg className="feed-search__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="m20 20-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
        </svg>
        <input
          className="feed-search__input"
          type="search"
          placeholder="Search feeds"
          aria-label="Search feeds"
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
  const load = useCallback(() => loadFeeds(credentials), [credentials]);
  const { result, isLoading, retry } = useAsyncLoad(load);
  const { feeds = [], errorMessage = '' } = result ?? {};

  return {
    feeds,
    errorMessage,
    isLoading,
    retry,
  };
}

async function loadFeeds(credentials: Credentials | null): Promise<FeedLoadResult> {
  try {
    return { feeds: await getAllFeeds(credentials) };
  } catch (error) {
    return { feeds: [], errorMessage: getLoadErrorMessage(error) };
  }
}

function filterFeeds(feeds: Feed[], normalizedQuery: string): Feed[] {
  if (!normalizedQuery) return feeds;

  return feeds.filter((feed) => (
    `${feed.title} ${feed.type} ${feed.url}`.toLowerCase().includes(normalizedQuery)
  ));
}

function getLoadErrorMessage(error: unknown): string {
  return isStatusError(error) && error.status === 401
    ? 'Unable to load feeds. Log in and try again.'
    : 'Unable to load feeds. Check your connection and try again.';
}

function isStatusError(error: unknown): error is Error & { status: number } {
  return error instanceof Error
    && 'status' in error
    && typeof error.status === 'number';
}
