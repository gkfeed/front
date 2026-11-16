import { useTranslation } from 'react-i18next';

import { ReviewDecisionButtons, type ReviewActionProps } from './ReaderReviewActions';
import { CopyLinkButton } from './CopyLinkButton';
import { useTikTokCommentsPreference } from '../hooks/useTikTokCommentsPreference';

export function ReaderMobileRail({
  isDeleting,
  onKeep,
  onDelete,
  copyLink,
}: ReviewActionProps & { copyLink?: string }) {
  const { t } = useTranslation();
  const [commentsExpanded, setCommentsExpanded] = useTikTokCommentsPreference();

  return (
    <aside className="reader__mobile-rail" aria-label={t('reader.reviewControls')}>
      <div className="reader__mobile-decisions">
        {copyLink ? (
          <>
            <CopyLinkButton url={copyLink} className="reader__mobile-copy-link" compact />
            <button type="button" className="reader__mobile-comments"
              aria-label={t(commentsExpanded ? 'comments.hide' : 'comments.show')}
              aria-expanded={commentsExpanded}
              onClick={() => setCommentsExpanded(!commentsExpanded)}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M20 11.3a7.8 7.8 0 0 1-8.1 7.5 9 9 0 0 1-3.4-.6L4 20l1.3-4.1A7 7 0 0 1 4 11.3a8 8 0 0 1 16 0Z" />
              </svg>
            </button>
          </>
        ) : null}
        <ReviewDecisionButtons compact isDeleting={isDeleting} onKeep={onKeep} onDelete={onDelete} />
      </div>
    </aside>
  );
}
