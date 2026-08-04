import { useState } from 'react';

import { useAuth } from '../state/useAuth';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
import {
  EMPTY_FEED,
  getFeedCreatorFields,
  isFeedFieldValid,
  trimFeed,
  type FeedCreatorMode,
} from '../domain/feedCreator';
import type { FeedInput } from '../types';

export type FeedCreatorSaveStatus = 'idle' | 'saving' | 'success' | 'error';

export type { FeedCreatorMode } from '../domain/feedCreator';

export function useFeedCreator() {
  const { credentials } = useAuth();
  const { feeds } = useFeatureUseCases();
  const [feed, setFeed] = useState<FeedInput>(EMPTY_FEED);
  const [mode, setMode] = useState<FeedCreatorMode>('lazy');
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<FeedCreatorSaveStatus>('idle');
  const isSaving = saveStatus === 'saving';
  const visibleFields = getFeedCreatorFields(mode);
  const isValid = visibleFields.every((field) => isFeedFieldValid(feed, field.id));

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
        await feeds.createFeed(trimFeed(feed), credentials);
      } else {
        await feeds.createFeedFromUrl({ url: feed.url.trim() }, credentials);
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
    isFeedFieldValid: (field: keyof FeedInput) => isFeedFieldValid(feed, field),
    updateMode,
    updateFeed,
    submitFeed,
  };
}
