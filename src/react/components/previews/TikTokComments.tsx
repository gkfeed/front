import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { FeedItem } from '../../types';
import { getFeedItemDescription } from '../../domain/feedItemDescription';
import { usePreviewVisibility } from '../../hooks/usePreviewVisibility';
import { useTikTokComments } from '../../hooks/useTikTokComments';
import { useTikTokCommentsPreference } from '../../hooks/useTikTokCommentsPreference';
import { trapFocus } from '../../platform/focusTrap';
import { CopyLinkButton } from '../CopyLinkButton';
import { TikTokCommentsContent } from './TikTokCommentsContent';

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
      trapFocus(event, commentsRef.current, { visibleOnly: true });
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
        <div className="tiktok-comments__actions">
          <CopyLinkButton
            url={item.link}
            className="tiktok-comments__copy-link"
          />
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
      </div>
      {isExpanded ? (
        <TikTokCommentsContent
          comments={comments}
          creator={creator}
          description={description}
          isLoading={isLoading}
          loadFailed={loadFailed}
          commentsId={commentsId}
          itemLink={item.link}
          onRetry={retry}
        />
      ) : null}
    </aside>
  );
}
