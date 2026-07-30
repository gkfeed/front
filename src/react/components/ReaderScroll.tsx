import type { FeedItem } from '../types';
import { FeedItemCard } from './FeedItemCard';

export function ReaderScroll({ items }: { items: FeedItem[] }) {
  return (
    <div
      id="reader-scroll-panel"
      className="reader__scroll-panel"
      role="region"
      aria-label="Scroll view"
    >
      <div className="reader__stream">
        {items.map((item) => <FeedItemCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}
