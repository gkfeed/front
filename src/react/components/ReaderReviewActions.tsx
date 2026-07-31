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
      <button type="button" className="reader__keep" onClick={onKeep} disabled={isDeleting}>
        <span aria-hidden="true">✓</span> {t('reader.keep')}
      </button>
      <button type="button" className="delete" onClick={onDelete} disabled={isDeleting}>
        <span aria-hidden="true">×</span> {isDeleting ? t('reader.deleting') : t('reader.delete')}
      </button>
    </div>
  );
}

export function CompactReviewActions({ isDeleting, onKeep, onDelete }: ReviewActionProps) {
  const { t } = useTranslation();

  return (
    <aside className="reader__compact-actions" aria-label={t('reader.itemActions')}>
      <button type="button" className="reader__mobile-keep" aria-label={t('reader.keepItem')} onClick={onKeep} disabled={isDeleting}>
        <span aria-hidden="true">✓</span>
      </button>
      <button
        type="button"
        className="reader__mobile-delete"
        aria-label={isDeleting ? t('reader.deletingItem') : t('reader.deleteItem')}
        onClick={onDelete}
        disabled={isDeleting}
      >
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  );
}
