import { useTranslation } from 'react-i18next';

import { useTikTokCommentsPreference } from '../hooks/useTikTokCommentsPreference';
import type { FeedItem } from '../types';
import { ReviewDecisionButtons, type ReviewActionProps } from './ReaderReviewActions';

export function ReaderMobileRail({
  item,
  isTikTok,
  isDeleting,
  onKeep,
  onDelete,
  onShowScroll,
}: ReviewActionProps & {
  item: FeedItem;
  isTikTok: boolean;
  onShowScroll: () => void;
}) {
  const { t } = useTranslation();
  const [commentsExpanded, setCommentsExpanded] = useTikTokCommentsPreference();

  return (
    <aside className="reader__mobile-rail" aria-label={t('reader.reviewControls')}>
      <div className="reader__mobile-shortcuts">
        <button type="button" onClick={onShowScroll} aria-label={t('reader.scrollView')}>
          <span aria-hidden="true">↕</span>
        </button>
        {isTikTok ? (
          <button
            type="button"
            aria-expanded={commentsExpanded}
            aria-controls={`tiktok-comments-list-${item.id}`}
            aria-label={commentsExpanded ? t('comments.hide') : t('comments.show')}
            onClick={() => setCommentsExpanded(!commentsExpanded)}
          >
            <span aria-hidden="true">☷</span>
          </button>
        ) : null}
        <a href={item.link} target="_blank" rel="noreferrer" aria-label={t('reader.openOriginal')}>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="reader__mobile-decisions">
        <ReviewDecisionButtons compact isDeleting={isDeleting} onKeep={onKeep} onDelete={onDelete} />
      </div>
    </aside>
  );
}
