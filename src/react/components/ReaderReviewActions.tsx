import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

export type ReviewActionProps = {
  isDeleting: boolean;
  onKeep: () => void;
  onDelete: () => void;
};

export function ReaderReviewActions({
  actionsRef,
  isDeleting,
  onKeep,
  onDelete,
  hidden,
}: ReviewActionProps & {
  actionsRef: RefObject<HTMLDivElement | null>;
  hidden: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      ref={actionsRef}
      className="reader__actions"
      aria-label={t('reader.itemActions')}
      hidden={hidden}
    >
      <ReviewDecisionButtons isDeleting={isDeleting} onKeep={onKeep} onDelete={onDelete} />
    </div>
  );
}

export function CompactReviewActions({ isDeleting, onKeep, onDelete }: ReviewActionProps) {
  const { t } = useTranslation();

  return (
    <aside className="reader__compact-actions" aria-label={t('reader.itemActions')}>
      <ReviewDecisionButtons compact isDeleting={isDeleting} onKeep={onKeep} onDelete={onDelete} />
    </aside>
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
        className={compact ? 'reader__mobile-delete' : 'delete'}
        aria-label={compact ? (isDeleting ? t('reader.deletingItem') : t('reader.deleteItem')) : undefined}
        onClick={onDelete}
        disabled={isDeleting}
      >
        <span aria-hidden="true">×</span>{compact ? null : ` ${isDeleting ? t('reader.deleting') : t('reader.delete')}`}
      </button>
    </>
  );
}
