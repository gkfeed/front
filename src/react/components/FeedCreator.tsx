import { useState } from 'react';
import type { FormEvent } from 'react';

import { createFeed } from '../services/feeds';
import { useAuth } from '../state/AuthContext';
import type { FeedInput } from '../types';

type CreatorFieldConfig = {
  id: keyof FeedInput;
  label: string;
  type: 'select' | 'text' | 'url';
  placeholder: string;
  error: string;
};

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

const EMPTY_FEED: FeedInput = {
  title: '',
  type: 'web',
  url: '',
};
const VALID_URL_PROTOCOLS: Record<string, true> = { 'http:': true, 'https:': true };

const FIELDS: readonly CreatorFieldConfig[] = [
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
  const { credentials } = useAuth();
  const [feed, setFeed] = useState<FeedInput>(EMPTY_FEED);
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const isSaving = saveStatus === 'saving';
  const isValid = FIELDS.every(({ id }) => isFeedFieldValid(id));

  function isFeedFieldValid(field: keyof FeedInput) {
    const value = feed[field].trim();
    if (!value) return false;

    return field === 'url' ? isValidFeedUrl(value) : true;
  }

  function updateFeed(field: keyof FeedInput, value: string) {
    setFeed((current) => ({ ...current, [field]: value }));
    setSaveStatus('idle');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!isValid || isSaving) return;

    setSaveStatus('saving');

    const trimmedFeed = {
      title: feed.title.trim(),
      type: feed.type.trim(),
      url: feed.url.trim(),
    };

    try {
      await createFeed(trimmedFeed, credentials);
      setFeed(EMPTY_FEED);
      setSubmitted(false);
      setSaveStatus('success');
    } catch {
      setSaveStatus('error');
    }
  }

  const statusMessage = getStatusMessage(saveStatus);

  return (
    <section className="creator" aria-labelledby="feed-create-title">
      <form className="creator__form" onSubmit={onSubmit} noValidate>
        <header className="creator__header">
          <h1 id="feed-create-title">Create feed</h1>
        </header>
        <div className="creator__fields">
          {FIELDS.map((field) => (
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
        <div className="creator__actions">
          {saveStatus !== 'idle' ? (
            <span className="creator__status" role={saveStatus === 'error' ? 'alert' : undefined} aria-live="polite">
              {statusMessage}
            </span>
          ) : null}
          <button type="submit" disabled={isSaving}>
            {isSaving ? 'Saving source' : 'Create feed'}
          </button>
        </div>
      </form>
    </section>
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
    <div className={`field field--${id}`}>
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

function isValidFeedUrl(value: string): boolean {
  try {
    return VALID_URL_PROTOCOLS[new URL(value).protocol] === true;
  } catch {
    return false;
  }
}

function getStatusMessage(saveStatus: SaveStatus): string {
  if (saveStatus === 'saving') return 'Saving source...';
  if (saveStatus === 'success') return 'Feed source saved.';
  if (saveStatus === 'error') return 'Could not save feed source. Try again.';
  return '';
}
