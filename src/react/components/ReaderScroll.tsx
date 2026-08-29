import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FeedItem } from '../types';
import { FeedItemCard } from './FeedItemCard';

const PAGE_SIZE = 20;

export function ReaderScroll({ items }: { items: FeedItem[] }) {
  const { t } = useTranslation();
  const [pageStart, setPageStart] = useState(0);
  const lastPageStart = Math.max(0, Math.floor((items.length - 1) / PAGE_SIZE) * PAGE_SIZE);
  const safePageStart = Math.min(pageStart, lastPageStart);
  const pageEnd = Math.min(safePageStart + PAGE_SIZE, items.length);

  useEffect(() => {
    if (pageStart > lastPageStart) setPageStart(lastPageStart);
  }, [lastPageStart, pageStart]);

  return (
    <div
      id="reader-scroll-panel"
      className="reader__scroll-panel"
      role="region"
      aria-label={t('reader.scrollView')}
    >
      <div className="reader__stream">
        {items.slice(safePageStart, pageEnd).map((item) => (
          <div className="reader__scroll-item" key={item.id}>
            <FeedItemCard item={item} />
          </div>
        ))}
      </div>
      {items.length > PAGE_SIZE ? (
        <nav className="reader__page-controls" aria-label={t('reader.pageControls')}>
          <button
            className="reader__page-button ui-button--secondary"
            type="button"
            disabled={safePageStart === 0}
            onClick={() => setPageStart((start) => Math.max(0, start - PAGE_SIZE))}
          >
            {t('reader.previousItems')}
          </button>
          <span aria-live="polite">
            {t('reader.pageStatus', { start: safePageStart + 1, end: pageEnd, total: items.length })}
          </span>
          <button
            className="reader__page-button ui-button--secondary"
            type="button"
            disabled={safePageStart >= lastPageStart}
            onClick={() => setPageStart((start) => Math.min(lastPageStart, start + PAGE_SIZE))}
          >
            {t('reader.nextItems')}
          </button>
        </nav>
      ) : null}
    </div>
  );
}
