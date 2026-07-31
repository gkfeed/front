import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useFeedCreator } from '../hooks/useFeedCreator';
import type { FeedCreatorMode, FeedCreatorSaveStatus } from '../hooks/useFeedCreator';
import type { FeedInput } from '../types';
import { FeedTypePicker } from './FeedTypePicker';

type CreatorFieldConfig = {
  id: keyof FeedInput;
  labelKey: string;
  type: 'select' | 'text' | 'url';
  placeholderKey?: string;
  errorKey: string;
};

const URL_FIELD: CreatorFieldConfig = {
  id: 'url',
  labelKey: 'creator.url',
  type: 'url',
  errorKey: 'creator.validUrl',
};

const URL_FIELDS: readonly CreatorFieldConfig[] = [URL_FIELD];

const MANUAL_FIELDS: readonly CreatorFieldConfig[] = [
  { id: 'title', labelKey: 'creator.title', type: 'text', placeholderKey: 'creator.titlePlaceholder', errorKey: 'creator.titleRequired' },
  { id: 'type', labelKey: 'creator.type', type: 'select', errorKey: 'creator.typeRequired' },
  URL_FIELD,
];

export function FeedCreator() {
  const { t } = useTranslation();
  const {
    feed,
    mode,
    submitted,
    saveStatus,
    isSaving,
    isFeedFieldValid,
    updateMode,
    updateFeed,
    submitFeed,
  } = useFeedCreator();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitFeed();
  }

  return (
    <section className="creator" aria-labelledby="feed-create-title">
      <form className="creator__form" onSubmit={onSubmit} noValidate>
        <h1 id="feed-create-title" className="page-title">{t('pages.createFeed')}</h1>
        <div className="creator__tabs" role="tablist" aria-label={t('creator.mode')}>
          <ModeTab mode="lazy" currentMode={mode} disabled={isSaving} onSelect={updateMode}>{t('creator.urlOnly')}</ModeTab>
          <ModeTab mode="extended" currentMode={mode} disabled={isSaving} onSelect={updateMode}>{t('creator.manual')}</ModeTab>
        </div>
        {mode === 'lazy' ? (
          <CreatorPanel
            id="feed-create-lazy-panel"
            labelledBy="feed-create-lazy-tab"
            fields={URL_FIELDS}
            feed={feed}
            submitted={submitted}
            isSaving={isSaving}
            isFeedFieldValid={isFeedFieldValid}
            updateFeed={updateFeed}
          />
        ) : (
          <CreatorPanel
            id="feed-create-extended-panel"
            labelledBy="feed-create-extended-tab"
            fields={MANUAL_FIELDS}
            feed={feed}
            submitted={submitted}
            isSaving={isSaving}
            isFeedFieldValid={isFeedFieldValid}
            updateFeed={updateFeed}
          />
        )}
        <div className="creator__actions">
          <span
            className={`creator__status creator__status--${saveStatus}`}
            role={saveStatus === 'error' ? 'alert' : undefined}
            aria-live="polite"
          >
            {getStatusMessage(saveStatus, t)}
          </span>
          <button className="creator__submit" type="submit" disabled={isSaving}>
            {isSaving ? t('creator.savingButton') : t('creator.addButton')}
          </button>
        </div>
      </form>
    </section>
  );
}

function getStatusMessage(saveStatus: FeedCreatorSaveStatus, t: (key: string) => string): string {
  if (saveStatus === 'saving') return t('creator.saving');
  if (saveStatus === 'success') return t('creator.saved');
  if (saveStatus === 'error') return t('creator.saveError');
  return '';
}

type ModeTabProps = {
  children: string;
  mode: FeedCreatorMode;
  currentMode: FeedCreatorMode;
  disabled: boolean;
  onSelect: (mode: FeedCreatorMode) => void;
};

function ModeTab({ children, mode, currentMode, disabled, onSelect }: ModeTabProps) {
  const selected = mode === currentMode;

  return (
    <button
      id={`feed-create-${mode}-tab`}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={`feed-create-${mode}-panel`}
      disabled={disabled}
      onClick={() => onSelect(mode)}
    >
      {children}
    </button>
  );
}

type CreatorPanelProps = {
  id: string;
  labelledBy: string;
  fields: readonly CreatorFieldConfig[];
  feed: FeedInput;
  submitted: boolean;
  isSaving: boolean;
  isFeedFieldValid: (field: keyof FeedInput) => boolean;
  updateFeed: (field: keyof FeedInput, value: string) => void;
};

function CreatorPanel({
  id,
  labelledBy,
  fields,
  feed,
  submitted,
  isSaving,
  isFeedFieldValid,
  updateFeed,
}: CreatorPanelProps) {
  return (
    <div id={id} className="creator__fields" role="tabpanel" aria-labelledby={labelledBy}>
      {fields.map((field) => (
        <CreatorField
          {...field}
          key={field.id}
          value={feed[field.id]}
          invalid={submitted && !isFeedFieldValid(field.id)}
          disabled={isSaving}
          onChange={(value) => updateFeed(field.id, value)}
        />
      ))}
    </div>
  );
}

type CreatorFieldProps = CreatorFieldConfig & {
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
};

function CreatorField({
  id,
  labelKey,
  type,
  value,
  placeholderKey,
  errorKey,
  invalid,
  disabled,
  onChange,
}: CreatorFieldProps) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;
  const label = t(labelKey);

  return (
    <div className={`field field--${id}${invalid ? ' field--invalid' : ''}`}>
      {id === 'type' ? (
        <>
          <span id="type-label" className="field__label">{label}</span>
          <FeedTypePicker
            value={value}
            disabled={disabled}
            invalid={invalid}
            errorId={errorId}
            onChange={onChange}
          />
        </>
      ) : (
        <>
          <label htmlFor={id}>{label}</label>
          <div className="field__control">
            <input
              type={type}
              id={id}
              name={id}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              autoComplete={id === 'url' ? 'url' : 'off'}
              placeholder={placeholderKey ? t(placeholderKey) : undefined}
              aria-describedby={invalid ? errorId : undefined}
              aria-invalid={invalid ? 'true' : undefined}
              disabled={disabled}
              required
            />
          </div>
        </>
      )}
      {invalid ? <p id={errorId} className="field__error" role="alert">{t(errorKey)}</p> : null}
    </div>
  );
}
