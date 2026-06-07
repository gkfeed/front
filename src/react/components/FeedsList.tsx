import { useEffect, useMemo, useState } from 'react';

import { getAllFeeds } from '../services/feeds';
import { useAuth } from '../state/AuthContext';
import { useFeedSearch } from '../state/FeedSearchContext';
import type { Feed } from '../types';
import { FeedCard } from './FeedCard';

export function FeedsList() {
  const { credentials } = useAuth();
  const { searchTerm } = useFeedSearch();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setErrorMessage('');

    getAllFeeds(credentials)
      .then((nextFeeds) => {
        if (isActive) setFeeds(nextFeeds);
      })
      .catch((error: unknown) => {
        if (!isActive) return;
        setErrorMessage(getLoadErrorMessage(error));
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [credentials]);

  const filteredFeeds = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return feeds;

    return feeds.filter((feed) => `${feed.title} ${feed.type} ${feed.url}`.toLowerCase().includes(query));
  }, [feeds, searchTerm]);
  const resultsAnnouncement = getResultsAnnouncement(filteredFeeds.length, searchTerm.trim());

  if (isLoading) {
    return (
      <div className="container">
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {resultsAnnouncement}
        </p>
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
      </div>
    );
  }

  return (
    <div className="container">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {resultsAnnouncement}
      </p>
      {errorMessage ? (
        <p className="empty" role="alert">{errorMessage}</p>
      ) : filteredFeeds.length ? (
        filteredFeeds.map((feed) => <FeedCard key={feed.id ?? feed.url} feed={feed} />)
      ) : (
        <p className="empty">No feeds found.</p>
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

function getLoadErrorMessage(error: unknown): string {
  return error instanceof Error && 'status' in error && error.status === 401
    ? 'Unable to load feeds. Log in and try again.'
    : 'Unable to load feeds. Check your connection and try again.';
}
