import { useEffect, useRef, useState } from 'react';
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
  const [isMobileReview, setIsMobileReview] = useState(false);
  const isDialogOpen = isExpanded && isMobileReview;
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
    const mediaQuery = window.matchMedia?.('(max-width: 640px)');
    const syncLayout = () => setIsMobileReview(Boolean(
      mediaQuery?.matches && commentsRef.current?.closest('.reader__item--tiktok'),
    ));
    syncLayout();
    mediaQuery?.addEventListener('change', syncLayout);
    return () => mediaQuery?.removeEventListener('change', syncLayout);
  }, []);

  useEffect(() => {
    if (!isDialogOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement
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
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isDialogOpen, setIsExpanded]);

  return (
    <aside
      ref={commentsRef}
      className="tiktok-comments"
      aria-label={t('comments.label')}
      role={isDialogOpen ? 'dialog' : undefined}
      aria-modal={isDialogOpen ? 'true' : undefined}
      aria-labelledby={`tiktok-comments-${item.id}`}
      tabIndex={isDialogOpen ? -1 : undefined}
      onKeyDown={(event) => {
        if (!isExpanded || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        setIsExpanded(false);
      }}
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
