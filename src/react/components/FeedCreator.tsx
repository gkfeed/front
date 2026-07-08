import type { FormEvent } from 'react';

import { useFeedCreator } from '../hooks/useFeedCreator';
import type { FeedCreatorMode } from '../hooks/useFeedCreator';
import type { FeedInput } from '../types';

type CreatorFieldConfig = {
  id: keyof FeedInput;
  label: string;
  type: 'select' | 'text' | 'url';
  placeholder: string;
  error: string;
};

const URL_FIELDS: readonly CreatorFieldConfig[] = [
  { id: 'url', label: 'URL', type: 'url', placeholder: 'https://example.com/feed.xml', error: 'Enter a valid feed URL.' },
] as const;

const MANUAL_FIELDS: readonly CreatorFieldConfig[] = [
  { id: 'title', label: 'Title', type: 'text', placeholder: 'Product updates', error: 'Enter a feed title.' },
  { id: 'type', label: 'Type', type: 'select', placeholder: '', error: 'Select a feed type.' },
  { id: 'url', label: 'URL', type: 'url', placeholder: 'https://example.com/feed.xml', error: 'Enter a valid feed URL.' },
] as const;

const FEED_TYPE_OPTIONS = [
  { value: 'web', label: 'Web' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'kinogo', label: 'Kinogo' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'yummyanime', label: 'YummyAnime' },
  { value: 'shiki', label: 'Shiki' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'vk', label: 'VK' },
  { value: 'yt', label: 'YouTube' },
  { value: 'ranobe.me', label: 'Ranobe.me' },
  { value: 'spoti', label: 'Spotify artist' },
  { value: 'rezka', label: 'Rezka' },
  { value: 'inst', label: 'Instagram' },
  { value: 'stories', label: 'Instagram stories' },
  { value: 'insolarance', label: 'Insolarance' },
  { value: 'mangalib', label: 'MangaLib' },
  { value: 'x', label: 'X' },
  { value: 'spoti:playlist', label: 'Spotify playlist' },
  { value: 'onefootball', label: 'OneFootball' },
  { value: 'rtl', label: 'RTL' },
  { value: 'rezka:collection', label: 'Rezka collection' },
  { value: 'matreshka', label: 'Matreshka' },
  { value: 'shiki:ongoing', label: 'Shiki ongoing' },
  { value: 'anilibria', label: 'AniLibria' },
  { value: 'pornhub', label: 'PornHub' },
  { value: 'porno365', label: 'Porno365' },
  { value: 'hltv', label: 'HLTV' },
  { value: 'liquidpedia', label: 'Liquipedia' },
  { value: 'sasflix', label: 'Sasflix' },
] as const;

export function FeedCreator() {
  const {
    feed,
    mode,
    submitted,
    saveStatus,
    isSaving,
    statusMessage,
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
        <h1 id="feed-create-title" className="page-title">Create feed</h1>
        <div className="creator__tabs" role="tablist" aria-label="Feed creation mode">
          <ModeTab mode="lazy" currentMode={mode} disabled={isSaving} onSelect={updateMode}>URL only</ModeTab>
          <ModeTab mode="extended" currentMode={mode} disabled={isSaving} onSelect={updateMode}>Manual</ModeTab>
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
            {statusMessage}
          </span>
          <button className="creator__submit" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving source' : 'Add feed'}
          </button>
        </div>
      </form>
    </section>
  );
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
  label,
  type,
  value,
  placeholder,
  error,
  invalid,
  disabled,
  onChange,
}: CreatorFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className={`field field--${id}${invalid ? ' field--invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        {id === 'type' ? (
          <select
            id={id}
            name={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-describedby={invalid ? errorId : undefined}
            aria-invalid={invalid ? 'true' : undefined}
            disabled={disabled}
            required
          >
            {FEED_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            id={id}
            name={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            autoComplete={id === 'url' ? 'url' : 'off'}
            placeholder={placeholder}
            aria-describedby={invalid ? errorId : undefined}
            aria-invalid={invalid ? 'true' : undefined}
            disabled={disabled}
            required
          />
        )}
      </div>
      {invalid ? <p id={errorId} className="field__error" role="alert">{error}</p> : null}
    </div>
  );
}
