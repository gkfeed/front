import { useTikTokCommentsPreference } from '../hooks/useTikTokCommentsPreference';
import type { FeedItem } from '../types';
import { useTranslation } from 'react-i18next';

export function ReaderTikTokControls({
  item,
  onClose,
}: {
  item: FeedItem;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [commentsExpanded, setCommentsExpanded] = useTikTokCommentsPreference();

  return (
    <button
      type="button"
      aria-expanded={commentsExpanded}
      aria-controls={`tiktok-comments-list-${item.id}`}
      onClick={() => {
        onClose();
        setCommentsExpanded(!commentsExpanded);
      }}
    >
      {commentsExpanded ? t('comments.hide') : t('comments.show')}
    </button>
  );
}
