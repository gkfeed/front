import { useState } from 'react';
import type { FormEvent } from 'react';

import { useFeedCreator } from '../hooks/useFeedCreator';
import type { FeedCreatorMode } from '../hooks/useFeedCreator';
import type { FeedInput } from '../types';
import { getFeedIcon } from './feedIcons';

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

const PICTOGRAM_TYPES = new Set(['web', 'tiktok', 'yt', 'inst', 'stories', 'x']);

function typeOptionId(value: string) {
  return `type-${value.replace(/[^a-z0-9]+/gi, '-')}`;
}

function getTypeInitials(label: string) {
  const words = label.replace(/\./g, ' ').split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((word) => word[0]).join('').slice(0, 2).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

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
            placeholder={placeholder}
            aria-describedby={invalid ? errorId : undefined}
            aria-invalid={invalid ? 'true' : undefined}
            disabled={disabled}
            required
          />
          </div>
        </>
      )}
      {invalid ? <p id={errorId} className="field__error" role="alert">{error}</p> : null}
    </div>
  );
}

type FeedTypePickerProps = {
  value: string;
  invalid: boolean;
  disabled: boolean;
  errorId: string;
  onChange: (value: string) => void;
};

function FeedTypePicker({ value, invalid, disabled, errorId, onChange }: FeedTypePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = FEED_TYPE_OPTIONS.find((option) => option.value === value) ?? FEED_TYPE_OPTIONS[0];
  const selectedIcon = getFeedIcon({ id: 0, title: selectedOption.label, type: selectedOption.value, url: '' });
  const selectedUsesPictogram = PICTOGRAM_TYPES.has(selectedOption.value);

  function selectType(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div className="type-picker" onKeyDown={(event) => event.key === 'Escape' && setIsOpen(false)}>
      <button
        className="type-picker__trigger"
        type="button"
        aria-labelledby="type-label type-picker-selected"
        aria-describedby={invalid ? errorId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-invalid={invalid ? 'true' : undefined}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="type-picker__mark type-picker__mark--selected" aria-hidden="true">
          {selectedUsesPictogram ? (
            <svg viewBox="0 0 48 48" focusable="false">
              <path d={selectedIcon.path} fill="currentColor" />
            </svg>
          ) : <span className="type-picker__initials">{getTypeInitials(selectedOption.label)}</span>}
        </span>
        <span id="type-picker-selected" className="type-picker__selected">{selectedOption.label}</span>
        <span className="type-picker__chevron" aria-hidden="true">⌄</span>
      </button>

      {isOpen ? (
        <div
          className="type-picker__panel"
          role="radiogroup"
          aria-labelledby="type-label"
          aria-describedby={invalid ? errorId : undefined}
          aria-invalid={invalid ? 'true' : undefined}
        >
          {FEED_TYPE_OPTIONS.map((option) => {
            const feedIcon = getFeedIcon({ id: 0, title: option.label, type: option.value, url: '' });
            const optionId = typeOptionId(option.value);
            const usePictogram = PICTOGRAM_TYPES.has(option.value);

            return (
              <label key={option.value} className="type-picker__option" htmlFor={optionId}>
                <input
                  id={optionId}
                  className="type-picker__input"
                  type="radio"
                  name="type"
                  value={option.value}
                  checked={value === option.value}
                  disabled={disabled}
                  required
                  onChange={(event) => selectType(event.target.value)}
                />
                <span className="type-picker__mark" aria-hidden="true">
                  {usePictogram ? (
                    <svg viewBox="0 0 48 48" focusable="false">
                      <path d={feedIcon.path} fill="currentColor" />
                    </svg>
                  ) : <span className="type-picker__initials">{getTypeInitials(option.label)}</span>}
                </span>
                <span className="type-picker__label">{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
