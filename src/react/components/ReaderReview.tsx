import { useRef } from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { isShortVideoFeedItem, isTikTokFeedItem } from '../domain/feedItemPreview';
import { useTikTokCommentsPreference } from '../hooks/useTikTokCommentsPreference';
import type { FeedItem } from '../types';
import { FeedItemCard } from './FeedItemCard';

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
  onShowScroll: () => void;
}) {
  const { t } = useTranslation();
  const isShortVideo = isShortVideoFeedItem(item);
  const isTikTok = isTikTokFeedItem(item);

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
        <MobileReviewRail
          item={item}
          remainingCount={remainingCount}
          isDeleting={isDeleting}
          onKeep={onKeep}
          onDelete={onDelete}
          onShowScroll={onShowScroll}
        />
      ) : null}
      {useCompactActions ? (
        <CompactReviewActions isDeleting={isDeleting} onKeep={onKeep} onDelete={onDelete} />
      ) : null}
      <div
        ref={reviewActionsRef}
        className="reader__actions"
        aria-label={t('reader.itemActions')}
        hidden={useCompactActions}
      >
        <button type="button" className="reader__keep" onClick={onKeep} disabled={isDeleting}>
          <span aria-hidden="true">✓</span> {t('reader.keep')}
        </button>
        <button type="button" className="delete" onClick={onDelete} disabled={isDeleting}>
          <span aria-hidden="true">×</span> {isDeleting ? t('reader.deleting') : t('reader.delete')}
        </button>
      </div>
      {deleteFailed ? (
        <p className="status status--error reader__error" role="alert">
          {t('reader.deleteError')}
        </p>
      ) : null}
      <div className="reader__count-row">
        <span className="reader__count">{t('reader.remaining', { count: remainingCount })}</span>
      </div>
    </div>
  );
}

function CompactReviewActions({
  isDeleting,
  onKeep,
  onDelete,
}: {
  isDeleting: boolean;
  onKeep: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  return (
    <aside className="reader__compact-actions" aria-label={t('reader.itemActions')}>
      <button type="button" className="reader__mobile-keep" aria-label={t('reader.keepItem')} onClick={onKeep} disabled={isDeleting}>
        <span aria-hidden="true">✓</span>
      </button>
      <button
        type="button"
        className="reader__mobile-delete"
        aria-label={isDeleting ? t('reader.deletingItem') : t('reader.deleteItem')}
        onClick={onDelete}
        disabled={isDeleting}
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}

function MobileReviewRail({
  item,
  remainingCount,
  isDeleting,
  onKeep,
  onDelete,
  onShowScroll,
}: {
  item: FeedItem;
  remainingCount: number;
  isDeleting: boolean;
  onKeep: () => void;
  onDelete: () => void;
  onShowScroll: () => void;
}) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [commentsExpanded, setCommentsExpanded] = useTikTokCommentsPreference();
  const isTikTok = isTikTokFeedItem(item);

  function closeMenu() {
    menuRef.current?.removeAttribute('open');
  }

  return (
    <aside className="reader__mobile-rail" aria-label={t('reader.reviewControls')}>
      <details ref={menuRef} className="reader__mobile-menu">
        <summary aria-label={t('reader.moreReviewActions')}><span aria-hidden="true">≡</span></summary>
        <div className="reader__mobile-menu-panel">
          <strong>{t('reader.moreActions')}</strong>
          <button type="button" onClick={() => { closeMenu(); onShowScroll(); }}>{t('reader.scrollView')}</button>
          {isTikTok ? (
            <button
              type="button"
              aria-expanded={commentsExpanded}
              aria-controls={`tiktok-comments-list-${item.id}`}
              onClick={() => { closeMenu(); setCommentsExpanded(!commentsExpanded); }}
            >
              {commentsExpanded ? t('comments.hide') : t('comments.show')}
            </button>
          ) : null}
          <a href={item.link} target="_blank" rel="noreferrer">
            {t('reader.openOriginal')} <span aria-hidden="true">↗</span>
          </a>
          <span className="reader__mobile-remaining">{t('reader.remaining', { count: remainingCount })}</span>
        </div>
      </details>
      <div className="reader__mobile-decisions">
        <button type="button" className="reader__mobile-keep" aria-label={t('reader.keepItem')} onClick={onKeep} disabled={isDeleting}>
          <span aria-hidden="true">✓</span>
        </button>
        <button
          type="button"
          className="reader__mobile-delete"
          aria-label={isDeleting ? t('reader.deletingItem') : t('reader.deleteItem')}
          onClick={onDelete}
          disabled={isDeleting}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </aside>
  );
}
