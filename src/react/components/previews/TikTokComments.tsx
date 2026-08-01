import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';

import type { FeedItem } from '../../types';
import { useTikTokComments } from '../../hooks/useTikTokComments';
import { useTikTokCommentsPreference } from '../../hooks/useTikTokCommentsPreference';
import { usePreviewVisibility } from '../../hooks/usePreviewVisibility';
import { UserIcon } from '../Icons';
import { getFeedItemDescription } from '../../domain/feedItemDescription';

export function TikTokComments({ item }: { item: FeedItem }) {
  const { t } = useTranslation();
  const commentsRef = useRef<HTMLElement>(null);
  const isVisible = usePreviewVisibility(commentsRef, '0px');
  const [isExpanded, setIsExpanded] = useTikTokCommentsPreference();
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const {
    comments,
    remoteDescription,
    creator,
    isLoading,
    loadFailed,
    retry,
  } = useTikTokComments(item.link, isExpanded && isVisible);
  const commentsId = `tiktok-comments-list-${item.id}`;
  const description = getFeedItemDescription(item.text, item.title) ?? remoteDescription;

  useEffect(() => {
    if (!isExpanded) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
      return undefined;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    commentsRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsExpanded(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(commentsRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        commentsRef.current?.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, setIsExpanded]);

  return (
    <aside
      ref={commentsRef}
      className="tiktok-comments"
      aria-label={t('comments.label')}
      role={isExpanded ? 'dialog' : undefined}
      aria-modal={isExpanded ? 'true' : undefined}
      aria-labelledby={`tiktok-comments-${item.id}`}
      tabIndex={isExpanded ? -1 : undefined}
    >
      <div className="tiktok-comments__toolbar">
        <h2 id={`tiktok-comments-${item.id}`} className="tiktok-comments__title">
          {t('comments.title')}
        </h2>
        <button
          type="button"
          className="tiktok-comments__toggle"
          aria-expanded={isExpanded}
          aria-controls={commentsId}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? t('comments.hide') : t('comments.show')}
        </button>
      </div>
      {isExpanded && isLoading ? (
        <div id={commentsId} className="tiktok-comments__empty" role="status">
          <p>{t('comments.loading')}</p>
        </div>
      ) : isExpanded && comments && (comments.length > 0 || description) ? (
        <ol id={commentsId} className="tiktok-comments__list">
          {description ? (
            <li className="tiktok-comments__comment tiktok-comments__description">
              {creator ? (
                <div className="tiktok-comments__creator">
                  <span className="tiktok-comments__creator-avatar">
                    {creator.avatarUrl ? (
                      <img src={creator.avatarUrl} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <UserIcon />
                    )}
                  </span>
                  <strong>{creator.name}</strong>
                </div>
              ) : null}
              <p>{renderDescription(description)}</p>
            </li>
          ) : null}
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
          {comments.length === 0 ? (
            <li className="tiktok-comments__empty">
              <p>{t('comments.none')}</p>
              <a href={item.link} target="_blank" rel="noreferrer">
                {t('comments.viewOnTikTok')} <span aria-hidden="true">↗</span>
              </a>
            </li>
          ) : null}
        </ol>
      ) : isExpanded && loadFailed ? (
        <div id={commentsId} className="tiktok-comments__empty" role="alert">
          <p>{t('comments.loadError')}</p>
          <button type="button" className="secondary" onClick={retry}>{t('live.tryAgain')}</button>
        </div>
      ) : isExpanded && comments ? (
        <div id={commentsId} className="tiktok-comments__empty">
          <p>{t('comments.none')}</p>
          <a href={item.link} target="_blank" rel="noreferrer">
            {t('comments.viewOnTikTok')} <span aria-hidden="true">↗</span>
          </a>
        </div>
      ) : null}
    </aside>
  );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
}

function renderDescription(description: string) {
  return description.split(/(#[\p{L}\p{N}_]+)/gu).map((part, index) => (
    part.startsWith('#')
      ? <strong className="tiktok-comments__hashtag" key={`${index}-${part}`}>{part}</strong>
      : part
  ));
}
