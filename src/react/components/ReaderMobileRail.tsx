import { useTranslation } from 'react-i18next';

import { ReviewDecisionButtons, type ReviewActionProps } from './ReaderReviewActions';
import { CopyLinkButton } from './CopyLinkButton';

export function ReaderMobileRail({
  isDeleting,
  onKeep,
  onDelete,
  copyLink,
}: ReviewActionProps & { copyLink?: string }) {
  const { t } = useTranslation();

  return (
    <aside className="reader__mobile-rail" aria-label={t('reader.reviewControls')}>
      <div className="reader__mobile-decisions">
        {copyLink ? (
          <CopyLinkButton url={copyLink} className="reader__mobile-copy-link" compact />
        ) : null}
        <ReviewDecisionButtons compact isDeleting={isDeleting} onKeep={onKeep} onDelete={onDelete} />
      </div>
    </aside>
  );
}
