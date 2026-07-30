import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { FeedItemCard } from '../components/FeedItemCard';
import { isShortVideoFeedItem, isTikTokFeedItem } from '../components/feedItemPreview';
import { useFeedReader } from '../hooks/useFeedReader';
import { useTikTokCommentsPreference } from '../hooks/useTikTokCommentsPreference';
import type { FeedItem } from '../types';

type ReaderMode = 'review' | 'scroll';

export function ReaderPage() {
  const [mode, setMode] = useState<ReaderMode>('review');
  const [compactActionsItemId, setCompactActionsItemId] = useState<number | null>(null);
  const reviewPanelRef = useRef<HTMLDivElement>(null);
  const reviewActionsRef = useRef<HTMLDivElement>(null);
  const reviewActionsHeightRef = useRef(52);
  const {
    items,
    currentItem,
    isLoading,
    isDeleting,
    loadFailed,
    deleteFailed,
    remainingCount,
    keepItem,
    deleteItem,
    retryLoad,
  } = useFeedReader();
  const useCompactActions = mode === 'review'
    && currentItem?.id === compactActionsItemId;

  useLayoutEffect(() => {
    if (mode !== 'review' || !currentItem) {
      setCompactActionsItemId(null);
      return;
    }

    const itemId = currentItem.id;
    const panel = reviewPanelRef.current;
    const card = panel?.querySelector<HTMLElement>(':scope > .reader-card');
    if (!panel || !card) return;

    function updateActionsLayout() {
      const actions = reviewActionsRef.current;
      if (actions && actions.offsetHeight > 0) {
        reviewActionsHeightRef.current = actions.offsetHeight;
      }

      const cardBottom = card!.getBoundingClientRect().bottom + window.scrollY;
      const panelGap = Number.parseFloat(window.getComputedStyle(panel!).rowGap) || 0;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const actionsBottom = cardBottom + panelGap + reviewActionsHeightRef.current;
      setCompactActionsItemId(actionsBottom > viewportHeight ? itemId : null);
    }

    updateActionsLayout();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateActionsLayout);
    resizeObserver?.observe(card);
    window.addEventListener('resize', updateActionsLayout);
    window.visualViewport?.addEventListener('resize', updateActionsLayout);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateActionsLayout);
      window.visualViewport?.removeEventListener('resize', updateActionsLayout);
    };
  }, [currentItem, mode]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        mode !== 'review'
        || !currentItem
        || isDeleting
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.shiftKey
        || isTextEntryTarget(event.target)
        || (event.target instanceof Element && event.target.closest('[role="tab"]'))
      ) {
        return;
      }

      if (event.key === 'a') {
        event.preventDefault();
        keepItem();
      } else if (event.key === 'd') {
        event.preventDefault();
        void deleteItem();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItem, deleteItem, isDeleting, keepItem, mode]);

  return (
    <section className="reader" aria-labelledby="reader-page-title">
      <h1 id="reader-page-title" className="sr-only">Reader</h1>

      <div className="reader__tabs" role="tablist" aria-label="Reader view">
        <ReaderModeTab mode="review" currentMode={mode} onSelect={setMode}>Review</ReaderModeTab>
        <ReaderModeTab mode="scroll" currentMode={mode} onSelect={setMode}>Scroll</ReaderModeTab>
      </div>

      {isLoading ? <ReaderLoading /> : null}

      {loadFailed ? (
        <div className="reader__state" role="alert">
          <p>Could not load your feed items.</p>
          <button type="button" className="secondary" onClick={retryLoad}>Try again</button>
        </div>
      ) : null}

      {!isLoading && !loadFailed && items.length === 0 ? (
        <div className="reader__state">
          <span className="reader__done-mark" aria-hidden="true">✓</span>
          <h2>You’re all caught up</h2>
          <p>There are no more items in this reading session.</p>
          <button type="button" className="secondary" onClick={retryLoad}>Check again</button>
        </div>
      ) : null}

      {mode === 'review' && currentItem ? (
        <div
          ref={reviewPanelRef}
          id="reader-review-panel"
          className={[
            'reader__item',
            useCompactActions ? 'reader__item--compact-actions' : '',
            isShortVideoFeedItem(currentItem) ? 'reader__item--short-video' : '',
            isTikTokFeedItem(currentItem) ? 'reader__item--tiktok' : '',
          ].filter(Boolean).join(' ')}
          role="tabpanel"
          aria-labelledby="reader-review-tab"
        >
          <FeedItemCard key={currentItem.id} item={currentItem} />
          {isShortVideoFeedItem(currentItem) ? (
            <MobileReviewRail
              item={currentItem}
              remainingCount={remainingCount}
              isDeleting={isDeleting}
              onKeep={keepItem}
              onDelete={deleteItem}
              onShowScroll={() => setMode('scroll')}
            />
          ) : null}
          {useCompactActions ? (
            <CompactReviewActions
              isDeleting={isDeleting}
              onKeep={keepItem}
              onDelete={deleteItem}
            />
          ) : null}
          <div
            ref={reviewActionsRef}
            className="reader__actions"
            aria-label="Feed item actions"
            hidden={useCompactActions}
          >
            <button type="button" className="reader__keep" onClick={keepItem} disabled={isDeleting}>
              <span aria-hidden="true">✓</span> Keep
            </button>
            <button type="button" className="delete" onClick={deleteItem} disabled={isDeleting}>
              <span aria-hidden="true">×</span> {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
          {deleteFailed ? (
            <p className="status status--error reader__error" role="alert">
              Could not delete this item. It is still in your feed; try again.
            </p>
          ) : null}
          <div className="reader__count-row">
            <span className="reader__count">{remainingCount} remaining</span>
          </div>
        </div>
      ) : null}

      {mode === 'review' && !isLoading && !loadFailed && items.length > 0 && !currentItem ? (
        <div
          id="reader-review-panel"
          className="reader__state"
          role="tabpanel"
          aria-labelledby="reader-review-tab"
        >
          <span className="reader__done-mark" aria-hidden="true">✓</span>
          <h2>You’ve reviewed everything</h2>
          <p>Switch to Scroll to browse all items again.</p>
        </div>
      ) : null}

      {mode === 'scroll' && !isLoading && !loadFailed && items.length > 0 ? (
        <div
          id="reader-scroll-panel"
          className="reader__scroll-panel"
          role="tabpanel"
          aria-labelledby="reader-scroll-tab"
        >
          <div className="reader__stream">
            {items.map((item) => <FeedItemCard key={item.id} item={item} />)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

type CompactReviewActionsProps = {
  isDeleting: boolean;
  onKeep: () => void;
  onDelete: () => void;
};

function CompactReviewActions({
  isDeleting,
  onKeep,
  onDelete,
}: CompactReviewActionsProps) {
  return (
    <aside className="reader__compact-actions" aria-label="Feed item actions">
      <button
        type="button"
        className="reader__mobile-keep"
        aria-label="Keep item"
        onClick={onKeep}
        disabled={isDeleting}
      >
        <span aria-hidden="true">✓</span>
      </button>
      <button
        type="button"
        className="reader__mobile-delete"
        aria-label={isDeleting ? 'Deleting item' : 'Delete item'}
        onClick={onDelete}
        disabled={isDeleting}
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}

type MobileReviewRailProps = {
  item: FeedItem;
  remainingCount: number;
  isDeleting: boolean;
  onKeep: () => void;
  onDelete: () => void;
  onShowScroll: () => void;
};

function MobileReviewRail({
  item,
  remainingCount,
  isDeleting,
  onKeep,
  onDelete,
  onShowScroll,
}: MobileReviewRailProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [commentsExpanded, setCommentsExpanded] = useTikTokCommentsPreference();
  const isTikTok = isTikTokFeedItem(item);

  function closeMenu() {
    menuRef.current?.removeAttribute('open');
  }

  return (
    <aside className="reader__mobile-rail" aria-label="Review controls">
      <details ref={menuRef} className="reader__mobile-menu">
        <summary aria-label="More review actions">
          <span aria-hidden="true">≡</span>
        </summary>
        <div className="reader__mobile-menu-panel">
          <strong>More actions</strong>
          <button
            type="button"
            onClick={() => {
              closeMenu();
              onShowScroll();
            }}
          >
            Scroll view
          </button>
          {isTikTok ? (
            <button
              type="button"
              aria-expanded={commentsExpanded}
              aria-controls={`tiktok-comments-list-${item.id}`}
              onClick={() => {
                closeMenu();
                setCommentsExpanded(!commentsExpanded);
              }}
            >
              {commentsExpanded ? 'Hide comments' : 'Show comments'}
            </button>
          ) : null}
          <a href={item.link} target="_blank" rel="noreferrer">
            Open original <span aria-hidden="true">↗</span>
          </a>
          <span className="reader__mobile-remaining">{remainingCount} remaining</span>
        </div>
      </details>

      <div className="reader__mobile-decisions">
        <button
          type="button"
          className="reader__mobile-keep"
          aria-label="Keep item"
          onClick={onKeep}
          disabled={isDeleting}
        >
          <span aria-hidden="true">✓</span>
        </button>
        <button
          type="button"
          className="reader__mobile-delete"
          aria-label={isDeleting ? 'Deleting item' : 'Delete item'}
          onClick={onDelete}
          disabled={isDeleting}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </aside>
  );
}

function isTextEntryTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
  );
}

type ReaderModeTabProps = {
  children: string;
  mode: ReaderMode;
  currentMode: ReaderMode;
  onSelect: (mode: ReaderMode) => void;
};

function ReaderModeTab({ children, mode, currentMode, onSelect }: ReaderModeTabProps) {
  const selected = mode === currentMode;

  return (
    <button
      id={`reader-${mode}-tab`}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={`reader-${mode}-panel`}
      onClick={() => onSelect(mode)}
    >
      {children}
    </button>
  );
}

function ReaderLoading() {
  return (
    <div className="reader__loading" role="status" aria-label="Loading feed items">
      <div className="reader__loading-line reader__loading-line--short" />
      <div className="reader__loading-line reader__loading-line--title" />
      <div className="reader__loading-line" />
      <div className="reader__loading-line" />
    </div>
  );
}
