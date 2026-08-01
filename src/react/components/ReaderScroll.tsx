import type { FeedItem } from '../types';
import { useTranslation } from 'react-i18next';
import { FeedItemCard } from './FeedItemCard';

export function ReaderScroll({ items }: { items: FeedItem[] }) {
  const { t } = useTranslation();

  return (
    <div
      id="reader-scroll-panel"
      className="reader__scroll-panel"
      role="region"
      aria-label={t('reader.scrollView')}
    >
      <div className="reader__stream">
        {items.map((item) => (
          <div className="reader__scroll-item" key={item.id}>
            <FeedItemCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
