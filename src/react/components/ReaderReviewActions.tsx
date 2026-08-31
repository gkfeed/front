import { useTranslation } from 'react-i18next';

export type ReviewActionProps = {
  isDeleting: boolean;
  onKeep: () => void;
  onDelete: () => void;
};

export function ReaderReviewActions({
  isDeleting,
  onKeep,
  onDelete,
}: ReviewActionProps) {
  const { t } = useTranslation();

  return (
    <div
      className="reader__actions"
      aria-label={t('reader.itemActions')}
    >
      <ReviewDecisionButtons isDeleting={isDeleting} onKeep={onKeep} onDelete={onDelete} />
    </div>
  );
}

export function ReviewDecisionButtons({
  compact = false,
  isDeleting,
  onKeep,
  onDelete,
}: ReviewActionProps & { compact?: boolean }) {
  const { t } = useTranslation();

  return (
    <>
      <button
        type="button"
        className={compact ? 'reader__mobile-keep' : 'reader__keep'}
        aria-label={compact ? t('reader.keepItem') : undefined}
        onClick={onKeep}
        disabled={isDeleting}
      >
        <span aria-hidden="true">✓</span>{compact ? null : ` ${t('reader.keep')}`}
      </button>
      <button
        type="button"
        className={compact ? 'reader__mobile-delete' : 'ui-button--danger'}
        aria-label={compact ? (isDeleting ? t('reader.deletingItem') : t('reader.deleteItem')) : undefined}
        onClick={onDelete}
        disabled={isDeleting}
      >
        <span aria-hidden="true">×</span>{compact ? null : ` ${isDeleting ? t('reader.deleting') : t('reader.delete')}`}
      </button>
    </>
  );
}
