import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { isShortVideoFeedItem, isTikTokFeedItem } from '../domain/feedItemPreview';
import type { FeedItem } from '../types';
import { FeedItemCard } from './FeedItemCard';
import { CompactReviewActions, ReaderReviewActions } from './ReaderReviewActions';
import { ReaderMobileRail } from './ReaderMobileRail';
import { ReaderTikTokControls } from './ReaderTikTokControls';

export function ReaderReview({
  item,
  remainingCount,
  isDeleting,
  deleteFailed,
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
  deleteFailed: boolean;
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
  const reviewActions = { isDeleting, onKeep, onDelete };

  return (
    <div
      ref={reviewPanelRef}
      id="reader-review-panel"
      className={[
        'reader__item',
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
          remainingCount={remainingCount}
          {...reviewActions}
          onShowScroll={onShowScroll}
          renderTikTokControl={isTikTok
            ? (closeMenu) => <ReaderTikTokControls item={item} onClose={closeMenu} />
            : undefined}
        />
      ) : null}
      {useCompactActions ? <CompactReviewActions {...reviewActions} /> : null}
      <ReaderReviewActions
        actionsRef={reviewActionsRef}
        hidden={useCompactActions}
        {...reviewActions}
      />
      {deleteFailed ? (
        <p className="status status--error reader__error" role="alert">
          {t('reader.deleteError')}
        </p>
      ) : null}
      <div className="reader__count-row">
        <button type="button" className="reader__reset" aria-label={t('reader.resetKeptItems')} onClick={onReset}>
          {t('reader.reset')}
        </button>
        <span className="reader__count">{t('reader.remaining', { count: remainingCount })}</span>
      </div>
    </div>
  );
}
