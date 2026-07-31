import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { FeedItem } from '../types';
import type { ReviewActionProps } from './ReaderReviewActions';

export function ReaderMobileRail({
  item,
  remainingCount,
  isDeleting,
  onKeep,
  onDelete,
  onShowScroll,
  renderTikTokControl,
}: ReviewActionProps & {
  item: FeedItem;
  remainingCount: number;
  onShowScroll: () => void;
  renderTikTokControl?: (closeMenu: () => void) => ReactNode;
}) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDetailsElement>(null);

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
          {renderTikTokControl?.(closeMenu)}
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
