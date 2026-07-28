import { useEffect, useState } from 'react';

import type { FeedItem } from '../../types';
import {
  fetchTikTokComments,
  type TikTokComment,
} from '../../services/tiktokComments';
import { useTikTokCommentsPreference } from '../../hooks/useTikTokCommentsPreference';
import { UserIcon } from '../Icons';

export function TikTokComments({ item }: { item: FeedItem }) {
  const [isExpanded, setIsExpanded] = useTikTokCommentsPreference();
  const [comments, setComments] = useState<TikTokComment[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const commentsId = `tiktok-comments-list-${item.id}`;

  useEffect(() => {
    if (!isExpanded || comments !== null || loadFailed) return;

    const controller = new AbortController();
    setIsLoading(true);
    fetchTikTokComments(item.link, controller.signal)
      .then(setComments)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setLoadFailed(true);
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, [comments, isExpanded, item.link, loadAttempt, loadFailed]);

  function retry() {
    setLoadFailed(false);
    setComments(null);
    setLoadAttempt((attempt) => attempt + 1);
  }

  return (
    <aside className="tiktok-comments" aria-label="TikTok comments">
      <div className="tiktok-comments__toolbar">
        <h2 id={`tiktok-comments-${item.id}`} className="tiktok-comments__title">
          Comments
        </h2>
        <button
          type="button"
          className="tiktok-comments__toggle"
          aria-expanded={isExpanded}
          aria-controls={commentsId}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Hide comments' : 'Show comments'}
        </button>
      </div>
      {isExpanded && isLoading ? (
        <div id={commentsId} className="tiktok-comments__empty" role="status">
          <p>Loading comments…</p>
        </div>
      ) : isExpanded && comments && comments.length > 0 ? (
        <ol id={commentsId} className="tiktok-comments__list">
          {comments.map((comment, index) => (
            <li className="tiktok-comments__comment" key={`${index}-${comment.text}`}>
              <div className="tiktok-comments__identity">
                <span className="tiktok-comments__avatar">
                  {comment.avatarUrl ? (
                    <img src={comment.avatarUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon />
                  )}
                </span>
                <span className="tiktok-comments__author">
                  <strong>{comment.author}</strong>
                  {comment.username ? <small>@{comment.username}</small> : null}
                </span>
              </div>
              <p>{comment.text}</p>
            </li>
          ))}
        </ol>
      ) : isExpanded && loadFailed ? (
        <div id={commentsId} className="tiktok-comments__empty" role="alert">
          <p>Could not load TikTok comments.</p>
          <button type="button" className="secondary" onClick={retry}>Try again</button>
        </div>
      ) : isExpanded && comments ? (
        <div id={commentsId} className="tiktok-comments__empty">
          <p>No comments are available for this video.</p>
          <a href={item.link} target="_blank" rel="noreferrer">
            View comments on TikTok <span aria-hidden="true">↗</span>
          </a>
        </div>
      ) : null}
    </aside>
  );
}
