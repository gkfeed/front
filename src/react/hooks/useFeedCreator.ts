import { useState } from 'react';

import { createFeed, createFeedFromUrl } from '../services/feeds';
import { useAuth } from '../state/useAuth';
import type { FeedInput } from '../types';

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
export type FeedCreatorMode = 'lazy' | 'extended';

const EMPTY_FEED: FeedInput = {
  title: '',
  type: 'web',
  url: '',
};
const FEED_FIELDS: readonly (keyof FeedInput)[] = ['title', 'type', 'url'];
const VALID_URL_PROTOCOLS: Record<string, true> = { 'http:': true, 'https:': true };

export function useFeedCreator() {
  const { credentials } = useAuth();
  const [feed, setFeed] = useState<FeedInput>(EMPTY_FEED);
  const [mode, setMode] = useState<FeedCreatorMode>('lazy');
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const isSaving = saveStatus === 'saving';
  const visibleFields = getVisibleFields(mode);
  const isValid = visibleFields.every((field) => isFeedFieldValid(feed, field));

  function updateFeed(field: keyof FeedInput, value: string) {
    setFeed((current) => ({ ...current, [field]: value }));
    setSaveStatus('idle');
  }

  function updateMode(nextMode: FeedCreatorMode) {
    setMode(nextMode);
    setSubmitted(false);
    setSaveStatus('idle');
  }

  async function submitFeed() {
    setSubmitted(true);

    if (!isValid || isSaving) return;

    setSaveStatus('saving');

    try {
      if (mode === 'extended') {
        await createFeed(trimFeed(feed), credentials);
      } else {
        await createFeedFromUrl({ url: feed.url.trim() }, credentials);
      }
      setFeed(EMPTY_FEED);
      setSubmitted(false);
      setSaveStatus('success');
    } catch {
      setSaveStatus('error');
    }
  }

  return {
    feed,
    mode,
    submitted,
    saveStatus,
    isSaving,
    statusMessage: getStatusMessage(saveStatus),
    isFeedFieldValid: (field: keyof FeedInput) => isFeedFieldValid(feed, field),
    updateMode,
    updateFeed,
    submitFeed,
  };
}

function getVisibleFields(mode: FeedCreatorMode): readonly (keyof FeedInput)[] {
  return mode === 'extended' ? FEED_FIELDS : ['url'];
}

function trimFeed(feed: FeedInput): FeedInput {
  return {
    title: feed.title.trim(),
    type: feed.type.trim(),
    url: feed.url.trim(),
  };
}

function isFeedFieldValid(feed: FeedInput, field: keyof FeedInput) {
  const value = feed[field].trim();
  if (!value) return false;

  return field === 'url' ? isValidFeedUrl(value) : true;
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
