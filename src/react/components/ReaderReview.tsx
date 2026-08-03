import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isShortVideoFeedItem, isTikTokFeedItem } from '../domain/feedItemPreview';
import {
  FALLBACK_FULLSCREEN_EVENT,
  exitReaderFullscreen,
  getMainElement,
  isAutomaticFallbackFullscreen,
  isReaderFullscreen,
  setAutomaticFallbackFullscreen,
} from '../services/readerFullscreen';
import type { FeedItem } from '../types';
import { FeedItemCard } from './FeedItemCard';
import { CompactReviewActions, ReaderReviewActions } from './ReaderReviewActions';
import { ReaderMobileRail } from './ReaderMobileRail';

export function ReaderReview({
  item,
  remainingCount,
  isDeleting,
  useCompactActions,
  reviewPanelRef,
  reviewActionsRef,
  onKeep,
  onDelete,
  onReset,
  onShowScroll,
}: {
  item: FeedItem;
  remainingCount: number;
  isDeleting: boolean;
  useCompactActions: boolean;
  reviewPanelRef: RefObject<HTMLDivElement | null>;
  reviewActionsRef: RefObject<HTMLDivElement | null>;
  onKeep: () => void;
  onDelete: () => void;
  onReset: () => void;
  onShowScroll: () => void;
}) {
  const { t } = useTranslation();
  const isShortVideo = isShortVideoFeedItem(item);
  const isTikTok = isTikTokFeedItem(item);
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [isFullscreen, setIsFullscreen] = useState(isReaderFullscreen);
  const reviewActions = { isDeleting, onKeep, onDelete };

  useEffect(() => {
    const updateFullscreenState = () => setIsFullscreen(isReaderFullscreen());
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    document.addEventListener(FALLBACK_FULLSCREEN_EVENT, updateFullscreenState);
    updateFullscreenState();

    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
      document.removeEventListener(FALLBACK_FULLSCREEN_EVENT, updateFullscreenState);
    };
  }, []);

  useEffect(() => {
    if (!isShortVideo || !isMobileViewport || !getMainElement() || isReaderFullscreen()) return;
    // Native fullscreen requires a user gesture in Chromium and Safari. The
    // reader's fallback is the reliable automatic mobile fullscreen mode.
    setAutomaticFallbackFullscreen(true);
  }, [isMobileViewport, isShortVideo, item.id]);

  useEffect(() => {
    if (isShortVideo && isMobileViewport) return;
    if (!isAutomaticFallbackFullscreen() || !isReaderFullscreen()) return;
    void exitReaderFullscreen();
  }, [isMobileViewport, isShortVideo]);

  useEffect(() => {
    const updateViewport = () => setIsMobileViewport(getIsMobileViewport());
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
    };
  }, []);

  return (
    <div
      ref={reviewPanelRef}
      id="reader-review-panel"
      className={[
        'reader__item',
        isFullscreen ? 'reader__item--fullscreen' : '',
        useCompactActions ? 'reader__item--compact-actions' : '',
        isShortVideo ? 'reader__item--short-video' : '',
        isTikTok ? 'reader__item--tiktok' : '',
      ].filter(Boolean).join(' ')}
      role="region"
      aria-label={t('reader.reviewView')}
    >
      <FeedItemCard key={item.id} item={item} />
      {isShortVideo ? (
        <ReaderMobileRail
          item={item}
          isTikTok={isTikTok}
          {...reviewActions}
          onShowScroll={onShowScroll}
        />
      ) : null}
      {useCompactActions ? <CompactReviewActions {...reviewActions} /> : null}
      <ReaderReviewActions
        actionsRef={reviewActionsRef}
        hidden={useCompactActions}
        {...reviewActions}
      />
      <div className="reader__count-row">
        <button type="button" className="reader__reset" aria-label={t('reader.resetKeptItems')} onClick={onReset}>
          {t('reader.reset')}
        </button>
        <span className="reader__count">{t('reader.remaining', { count: remainingCount })}</span>
      </div>
    </div>
  );
}

function getIsMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= 640;
}
