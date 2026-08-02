import { useTranslation } from 'react-i18next';

import { ReviewDecisionButtons, type ReviewActionProps } from './ReaderReviewActions';

export function ReaderMobileRail({
  isDeleting,
  onKeep,
  onDelete,
}: ReviewActionProps) {
  const { t } = useTranslation();

  return (
    <aside className="reader__mobile-rail" aria-label={t('reader.reviewControls')}>
      <div className="reader__mobile-decisions">
        <ReviewDecisionButtons compact isDeleting={isDeleting} onKeep={onKeep} onDelete={onDelete} />
      </div>
    </aside>
  );
}
