import { useTranslation } from 'react-i18next';

import {
  getFeedPriority,
  MAX_FEED_PRIORITY,
  MIN_FEED_PRIORITY,
} from '../state/feedPriority';
import { useFeedPriority } from '../state/useFeedPriority';

export function FeedPriorityControls({ feedId }: { feedId: number }) {
  const { t } = useTranslation();
  const { priorities, changePriority } = useFeedPriority();
  const priority = getFeedPriority(priorities, feedId);

  return (
    <div className="reader__feed-priority" aria-label={t('feed.priorityControls', { feedId })}>
      <span className="reader__feed-priority-label">{t('feed.priorityLabel')}</span>
      <span className="reader__feed-priority-buttons">
        <button
          type="button"
          aria-label={t('feed.decreasePriority', { feedId })}
          title={t('feed.decreasePriority', { feedId })}
          disabled={priority <= MIN_FEED_PRIORITY}
          onClick={() => changePriority(feedId, -1)}
        >−</button>
        <button
          type="button"
          aria-label={t('feed.increasePriority', { feedId })}
          title={t('feed.increasePriority', { feedId })}
          disabled={priority >= MAX_FEED_PRIORITY}
          onClick={() => changePriority(feedId, 1)}
        >+</button>
      </span>
    </div>
  );
}
