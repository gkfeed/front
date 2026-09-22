import { useState } from 'react';

import {
  EMPTY_FEED,
  getFeedCreatorFields,
  isFeedFieldValid,
  type FeedCreatorMode,
  type FeedTypeDetectionStatus,
} from '../../domain/feedCreator';
import { useAuth } from '../../state/useAuth';
import { useFeatureUseCases } from '../../state/useFeatureUseCases';
import type { FeedInput } from '../../types';

export type FeedCreatorSaveStatus = 'idle' | 'saving' | 'success' | 'error';
export function useCreateFeedPageModel() {
  const { credentials } = useAuth();
  const { feeds } = useFeatureUseCases();
  const [feed, setFeed] = useState<FeedInput>(EMPTY_FEED);
  const [mode, setMode] = useState<FeedCreatorMode>('lazy');
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<FeedCreatorSaveStatus>('idle');
  const [detectionStatus, setDetectionStatus] = useState<FeedTypeDetectionStatus>({ state: 'idle' });
  const isSaving = saveStatus === 'saving';
  const fields = getFeedCreatorFields(mode);
  const isValid = fields.every((field) => isFeedFieldValid(feed, field.id));

  function updateFeed(field: keyof FeedInput, value: string) {
    setFeed((current) => ({ ...current, [field]: value }));
    setSaveStatus('idle');
    if (field === 'url' || field === 'title') setDetectionStatus({ state: 'idle' });
  }

  function updateMode(nextMode: FeedCreatorMode) {
    setMode(nextMode);
    setSubmitted(false);
    setSaveStatus('idle');
    setDetectionStatus({ state: 'idle' });
  }

  async function detectFeedType() {
    if (mode !== 'extended' || !isFeedFieldValid(feed, 'url') || detectionStatus.state === 'detecting') return;
    setDetectionStatus({ state: 'detecting' });
    try {
      const suggestion = await feeds.suggestFeedType(feed.url.trim(), feed.title.trim());
      if (suggestion.confidence < 0.35) {
        setDetectionStatus({ state: 'uncertain' });
        return;
      }
      setFeed((current) => ({ ...current, type: suggestion.type }));
      setDetectionStatus({ state: 'success', confidence: suggestion.confidence });
    } catch {
      setDetectionStatus({ state: 'error' });
    }
  }

  async function submitFeed() {
    setSubmitted(true);
    if (!isValid || isSaving) return;

    setSaveStatus('saving');
    try {
      await feeds.saveFeed(feed, mode, credentials);
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
    fields,
    submitted,
    saveStatus,
    detectionStatus,
    isSaving,
    isFeedFieldValid: (field: keyof FeedInput) => isFeedFieldValid(feed, field),
    updateMode,
    updateFeed,
    detectFeedType,
    submitFeed,
  };
}
