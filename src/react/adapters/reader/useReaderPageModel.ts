import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

import { useFeedReader } from './useFeedReader';
import { useReviewShortcuts } from '../../hooks/useReviewShortcuts';
import { getRequestErrorMessage } from '../../services/authError';
import {
  exitReaderFullscreen,
  isAutomaticFallbackFullscreen,
} from '../../services/readerFullscreen';
import { getReaderMode } from '../../state/readerMode';
import { useReaderItemOrderPreferences } from '../../state/useReaderItemOrderPreferences';

export type { FeedItemDeletion } from '../../hooks/useFeedItemDeletion';

type Translator = (key: string) => string;

export function useReaderPageModel(t: Translator) {
  const reviewPanelRef = useRef<HTMLDivElement>(null);
  const { search } = useLocation();
  const mode = getReaderMode(search);
  const { itemOrder } = useReaderItemOrderPreferences();

  useEffect(() => () => {
    void exitReaderFullscreen();
  }, []);

  useEffect(() => {
    if (mode === 'review' || !isAutomaticFallbackFullscreen()) return;
    void exitReaderFullscreen();
  }, [mode]);

  const reader = useFeedReader({
    prefetchNextPreviews: mode === 'review',
    itemOrder,
  });
  useReviewShortcuts({
    mode,
    currentItem: reader.currentItem,
    isDeleting: reader.currentItem ? reader.isItemPending(reader.currentItem.id) : false,
    onKeep: reader.keepItem,
    onDelete: reader.deleteItem,
  });

  return {
    ...reader,
    mode,
    itemOrder,
    reviewPanelRef,
    hasLoadedContent: !reader.isLoading && (!reader.loadFailed || reader.items.length > 0),
    loadErrorMessage: reader.loadFailed
      ? getRequestErrorMessage(reader.loadError, t, 'reader.loadError')
      : '',
  };
}
