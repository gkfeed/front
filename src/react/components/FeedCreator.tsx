import { useState } from 'react';
import type { FormEvent } from 'react';

import { createFeed } from '../services/feeds';
import { useAuth } from '../state/AuthContext';
import type { Feed } from '../types';

const EMPTY_FEED: Feed = {
  title: '',
  type: 'rss',
  url: '',
};

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function FeedCreator() {
  const { credentials } = useAuth();
  const [feed, setFeed] = useState<Feed>(EMPTY_FEED);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const isValid = Boolean(feed.title.trim() && feed.type.trim() && feed.url.trim());

  function updateFeed(field: keyof Feed, value: string) {
    setFeed((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!isValid || isSaving) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      await createFeed(feed, credentials);
      setFeed(EMPTY_FEED);
      setSubmitted(false);
      setSaveStatus('success');
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }

  const statusMessage = getStatusMessage(saveStatus, feed);

  return (
    <section className="creator" aria-labelledby="feed-create-title">
      <form className="creator__form" onSubmit={onSubmit} noValidate>
        <header className="creator__header">
          <h1 id="feed-create-title">Create feed</h1>
        </header>
        <div className="creator__fields">
          <CreatorField
            id="title"
            label="Title"
            type="text"
            value={feed.title}
            placeholder="Product updates"
            error="Enter a feed title."
            invalid={submitted && !feed.title.trim()}
            onChange={(value) => updateFeed('title', value)}
          />
          <CreatorField
            id="type"
            label="Type"
            type="text"
            value={feed.type}
            placeholder="rss"
            error="Enter a feed type."
            invalid={submitted && !feed.type.trim()}
            onChange={(value) => updateFeed('type', value)}
          />
          <CreatorField
            id="url"
            label="URL"
            type="url"
            value={feed.url}
            placeholder="https://example.com/feed.xml"
            error="Enter a valid feed URL."
            invalid={submitted && !feed.url.trim()}
            onChange={(value) => updateFeed('url', value)}
          />
        </div>
        <div className="creator__actions">
          {saveStatus !== 'idle' ? (
            <span className="creator__status" role={saveStatus === 'error' ? 'alert' : undefined} aria-live="polite">
              {statusMessage}
            </span>
          ) : null}
          <button type="submit" disabled={!isValid || isSaving}>
            {isSaving ? 'Saving source' : 'Create feed'}
          </button>
        </div>
      </form>
    </section>
  );
}

function CreatorField(props: {
  id: keyof Feed;
  label: string;
  type: string;
  value: string;
  placeholder: string;
  error: string;
  invalid: boolean;
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
          required
        />
      </div>
      {props.invalid ? <p id={errorId} className="field__error">{props.error}</p> : null}
    </div>
  );
}

function getStatusMessage(saveStatus: SaveStatus, feed: Feed): string {
  if (saveStatus === 'saving') return 'Saving source...';
  if (saveStatus === 'success') return 'Feed source saved.';
  if (saveStatus === 'error') return 'Could not save feed source. Try again.';
  return feed.title && feed.type && feed.url ? 'Ready to save' : 'Complete all fields';
}
