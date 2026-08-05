import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { useFeedReader } from '../../hooks/useFeedReader';
import { useReviewActionsLayout } from '../../hooks/useReviewActionsLayout';
import { useReviewShortcuts } from '../../hooks/useReviewShortcuts';
import { getRequestErrorMessage } from '../../services/authError';
import {
  exitReaderFullscreen,
  isAutomaticFallbackFullscreen,
} from '../../services/readerFullscreen';
import { getReaderMode } from '../../state/readerMode';

type Translator = (key: string) => string;

export function useReaderPageModel(t: Translator) {
  const { search } = useLocation();
  const mode = getReaderMode(search);

  useEffect(() => () => {
    void exitReaderFullscreen();
  }, []);

  useEffect(() => {
    if (mode === 'review' || !isAutomaticFallbackFullscreen()) return;
    void exitReaderFullscreen();
  }, [mode]);

  const reader = useFeedReader({ prefetchNextPreviews: mode === 'review' });
  const {
    panelRef: reviewPanelRef,
    actionsRef: reviewActionsRef,
    useCompactActions,
  } = useReviewActionsLayout(mode, reader.currentItem);

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
    reviewPanelRef,
    reviewActionsRef,
    useCompactActions,
    hasLoadedContent: !reader.isLoading && !reader.loadFailed,
    loadErrorMessage: reader.loadFailed
      ? getRequestErrorMessage(reader.loadError, t, 'reader.loadError')
      : '',
  };
}
