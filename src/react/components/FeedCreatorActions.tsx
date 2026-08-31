import { useTranslation } from 'react-i18next';

import type { FeedCreatorSaveStatus } from './feedCreatorTypes';

export function FeedCreatorActions({
  saveStatus,
  isSaving,
}: {
  saveStatus: FeedCreatorSaveStatus;
  isSaving: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="creator__actions">
      <span
        className={`creator__status creator__status--${saveStatus}`}
        role={saveStatus === 'error' ? 'alert' : undefined}
        aria-live="polite"
      >
        {getStatusMessage(saveStatus, t)}
      </span>
      <button className="ui-primary-button creator__submit" type="submit" disabled={isSaving}>
        {isSaving ? t('creator.savingButton') : t('creator.addButton')}
      </button>
    </div>
  );
}

function getStatusMessage(saveStatus: FeedCreatorSaveStatus, t: (key: string) => string): string {
  if (saveStatus === 'saving') return t('creator.saving');
  if (saveStatus === 'success') return t('creator.saved');
  if (saveStatus === 'error') return t('creator.saveError');
  return '';
}
