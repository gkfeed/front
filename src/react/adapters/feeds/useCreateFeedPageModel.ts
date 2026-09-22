import { useEffect, useRef, useState } from 'react';

import {
  EMPTY_FEED,
  getFeedCreatorFields,
  isFeedFieldValid,
  type FeedTypeDetectionStatus,
} from '../../domain/feedCreator';
import { useAuth } from '../../state/useAuth';
import { useFeatureUseCases } from '../../state/useFeatureUseCases';
import type { FeedInput } from '../../types';

export type FeedCreatorSaveStatus = 'idle' | 'saving' | 'success' | 'error';
const DETECTION_DELAY_MS = 500;

export function useCreateFeedPageModel() {
  const { credentials } = useAuth();
  const { feeds } = useFeatureUseCases();
  const [feed, setFeed] = useState<FeedInput>(EMPTY_FEED);
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<FeedCreatorSaveStatus>('idle');
  const [detectionStatus, setDetectionStatus] = useState<FeedTypeDetectionStatus>({ state: 'idle' });
  const generatedTitle = useRef<string | null>(null);
  const isSaving = saveStatus === 'saving';
  const fields = getFeedCreatorFields('extended');
  const isValid = fields.every((field) => isFeedFieldValid(feed, field.id));

  function updateFeed(field: keyof FeedInput, value: string) {
    if (field === 'title') generatedTitle.current = null;
    const clearGeneratedTitle = field === 'url'
      && generatedTitle.current !== null
      && feed.title === generatedTitle.current;
    if (clearGeneratedTitle) generatedTitle.current = null;
    setFeed((current) => ({
      ...current,
      [field]: value,
      ...(clearGeneratedTitle ? { title: '' } : {}),
    }));
    setSaveStatus('idle');
    if (field === 'url') setDetectionStatus({ state: 'idle' });
  }

  useEffect(() => {
    if (!isFeedFieldValid(feed, 'url')) return;
    const controller = new AbortController();
    const url = feed.url.trim();
    const title = feed.title.trim();
    const timeoutId = window.setTimeout(() => {
      setDetectionStatus({ state: 'detecting' });
      void feeds.suggestFeedType(url, title, controller.signal).then((suggestion) => {
        if (suggestion.confidence < 0.35) {
          setDetectionStatus({ state: 'uncertain' });
          return;
        }
        setFeed((current) => ({ ...current, type: suggestion.type }));
        setDetectionStatus({ state: 'success', confidence: suggestion.confidence });
      }).catch(() => {
        if (!controller.signal.aborted) setDetectionStatus({ state: 'error' });
      });

      void feeds.suggestFeedTitle(url, controller.signal).then((suggestedTitle) => {
        if (!suggestedTitle) return;
        setFeed((current) => {
          if (current.title.trim() && current.title !== generatedTitle.current) return current;
          generatedTitle.current = suggestedTitle;
          return { ...current, title: suggestedTitle };
        });
      }).catch(() => undefined);
    }, DETECTION_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  // Title changes must not restart URL detection or metadata loading.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.url, feeds]);

  async function submitFeed() {
    setSubmitted(true);
    if (!isValid || isSaving) return;

    setSaveStatus('saving');
    try {
      await feeds.saveFeed(feed, 'extended', credentials);
      setFeed(EMPTY_FEED);
      generatedTitle.current = null;
      setSubmitted(false);
      setSaveStatus('success');
    } catch {
      setSaveStatus('error');
    }
  }

  return {
    feed,
    fields,
    submitted,
    saveStatus,
    detectionStatus,
    isSaving,
    isFeedFieldValid: (field: keyof FeedInput) => isFeedFieldValid(feed, field),
    updateFeed,
    submitFeed,
  };
}
