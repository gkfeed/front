import { useState } from 'react';
import type { FormEvent } from 'react';

import { createFeed } from '../services/feeds';
import { useAuth } from '../state/AuthContext';
import type { FeedInput } from '../types';

const EMPTY_FEED: FeedInput = {
  title: '',
  type: 'rss',
  url: '',
};

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

const FIELDS = [
  { id: 'title', label: 'Title', type: 'text', placeholder: 'Product updates', error: 'Enter a feed title.' },
  { id: 'type', label: 'Type', type: 'text', placeholder: 'rss', error: 'Enter a feed type.' },
  { id: 'url', label: 'URL', type: 'url', placeholder: 'https://example.com/feed.xml', error: 'Enter a valid feed URL.' },
] as const;

export function FeedCreator() {
  const { credentials } = useAuth();
  const [feed, setFeed] = useState<FeedInput>(EMPTY_FEED);
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const isSaving = saveStatus === 'saving';
  const isValid = FIELDS.every(({ id }) => isFieldValid(id));

  function isFieldValid(field: keyof FeedInput) {
    const value = feed[field].trim();
    return Boolean(value && (field !== 'url' || URL.canParse(value) && /^https?:$/.test(new URL(value).protocol)));
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

    try {
      await createFeed({
        title: feed.title.trim(),
        type: feed.type.trim(),
        url: feed.url.trim(),
      }, credentials);
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
              invalid={submitted && !isFieldValid(field.id)}
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

function CreatorField(props: {
  id: keyof FeedInput;
  label: string;
  type: string;
  value: string;
  placeholder: string;
  error: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const errorId = `${props.id}-error`;

  return (
    <div className={`field field--${props.id}`}>
      <label htmlFor={props.id}>{props.label}</label>
      <div className="field__control">
        <input
          type={props.type}
          id={props.id}
          name={props.id}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          autoComplete={props.id === 'url' ? 'url' : 'off'}
          placeholder={props.placeholder}
          aria-describedby={props.invalid ? errorId : undefined}
          aria-invalid={props.invalid ? 'true' : undefined}
          disabled={props.disabled}
          required
        />
      </div>
      {props.invalid ? <p id={errorId} className="field__error" role="alert">{props.error}</p> : null}
    </div>
  );
}

function getStatusMessage(saveStatus: SaveStatus): string {
  if (saveStatus === 'saving') return 'Saving source...';
  if (saveStatus === 'success') return 'Feed source saved.';
  if (saveStatus === 'error') return 'Could not save feed source. Try again.';
  return '';
}
