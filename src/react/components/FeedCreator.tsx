import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import '../../styles/feed-creator.css';
import { FeedCreatorActions } from './FeedCreatorActions';
import { FeedCreatorFields } from './FeedCreatorFields';
import { FeedCreatorModeTabs } from './FeedCreatorModeTabs';
import type { FeedCreatorModel } from './feedCreatorTypes';

export type { FeedCreatorModel } from './feedCreatorTypes';

export function FeedCreator({ model }: { model: FeedCreatorModel }) {
  const { t } = useTranslation();
  const {
    feed,
    mode,
    fields,
    submitted,
    saveStatus,
    isSaving,
    isFeedFieldValid,
    updateMode,
    updateFeed,
    submitFeed,
  } = model;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitFeed();
  }

  return (
    <section className="creator" aria-labelledby="feed-create-title">
      <form className="creator__form" onSubmit={onSubmit} noValidate>
        <h1 id="feed-create-title" className="page-title">{t('pages.createFeed')}</h1>
        <FeedCreatorModeTabs
          mode={mode}
          disabled={isSaving}
          onSelect={updateMode}
          labels={{
            ariaLabel: t('creator.mode'),
            lazy: t('creator.urlOnly'),
            extended: t('creator.manual'),
          }}
        />
        <FeedCreatorFields
          id={`feed-create-${mode}-panel`}
          labelledBy={`feed-create-${mode}-tab`}
          fields={fields}
          feed={feed}
          submitted={submitted}
          isSaving={isSaving}
          isFeedFieldValid={isFeedFieldValid}
          updateFeed={updateFeed}
        />
        <FeedCreatorActions saveStatus={saveStatus} isSaving={isSaving} />
      </form>
    </section>
  );
}
