import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { isShortVideoFeedItem, isTikTokFeedItem } from '../domain/feedItemProviderPresentation';
import { useAutomaticReaderFullscreen } from '../hooks/useAutomaticReaderFullscreen';
import type { FeedItem } from '../types';
import { FeedItemCard } from './FeedItemCard';
import { ReaderReviewActions } from './ReaderReviewActions';
import { ReaderMobileRail } from './ReaderMobileRail';
import { FeedPriorityControls } from './FeedPriorityControls';

export function ReaderReview({
  item,
  remainingCount,
  isDeleting,
  reviewPanelRef,
  onKeep,
  onDelete,
  onReset,
}: {
  item: FeedItem;
  remainingCount: number;
  isDeleting: boolean;
  reviewPanelRef: RefObject<HTMLDivElement | null>;
  onKeep: () => void;
  onDelete: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const isShortVideo = isShortVideoFeedItem(item);
  const isTikTok = isTikTokFeedItem(item);
  const isFullscreen = useAutomaticReaderFullscreen({
    itemId: item.id,
    shouldEnterAutomatically: isShortVideo,
  });
  const reviewActions = { isDeleting, onKeep, onDelete };

  return (
    <div
      ref={reviewPanelRef}
      id="reader-review-panel"
      className={[
        'reader__item',
        !isShortVideo ? 'reader__item--card-flow' : '',
        isFullscreen ? 'reader__item--fullscreen' : '',
        isShortVideo ? 'reader__item--short-video' : '',
        isTikTok ? 'reader__item--tiktok' : '',
      ].filter(Boolean).join(' ')}
      role="region"
      aria-label={t('reader.reviewView')}
    >
      <FeedItemCard key={item.id} item={item} />
      {isShortVideo ? (
        <ReaderMobileRail
          {...reviewActions}
          copyLink={isTikTok ? item.link : undefined}
        />
      ) : null}
      <ReaderReviewActions {...reviewActions} />
      <div className="reader__count-row">
        <button type="button" className="reader__reset" aria-label={t('reader.resetKeptItems')} onClick={onReset}>
          {t('reader.reset')}
        </button>
        <FeedPriorityControls feedId={item.feedId} />
        <span className="reader__count">{t('reader.remaining', { count: remainingCount })}</span>
      </div>
    </div>
  );
}
