import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchTikTokComments,
  type TikTokCommentsResult,
} from '../services/tiktokComments';

export type TikTokCommentsLoadStatus = 'idle' | 'loading' | 'success' | 'error';

type TikTokCommentsLoadState = {
  link: string;
  status: TikTokCommentsLoadStatus;
  result: TikTokCommentsResult | null;
};

const getIdleState = (link: string): TikTokCommentsLoadState => ({
  link,
  status: 'idle',
  result: null,
});

export function useTikTokComments(link: string, enabled: boolean) {
  const [state, setState] = useState<TikTokCommentsLoadState>(() => getIdleState(link));
  const [retryCount, setRetryCount] = useState(0);
  const stateRef = useRef(state);
  const updateState = useCallback((nextState: TikTokCommentsLoadState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  useEffect(() => {
    const currentState = stateRef.current;
    if (!enabled || (currentState.link === link && currentState.status !== 'idle')) return;

    const controller = new AbortController();
    let isCurrentRequest = true;
    updateState({ link, status: 'loading', result: null });

    fetchTikTokComments(link, controller.signal)
      .then((result) => {
        if (isCurrentRequest) updateState({ link, status: 'success', result });
      })
      .catch((error: unknown) => {
        if (isCurrentRequest && !isAbortError(error)) {
          updateState({ link, status: 'error', result: null });
        }
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [enabled, link, retryCount, updateState]);

  useEffect(() => {
    const currentState = stateRef.current;
    if (enabled || currentState.link !== link || currentState.status !== 'loading') return;
    updateState(getIdleState(link));
  }, [enabled, link, updateState]);

  const currentState = state.link === link ? state : getIdleState(link);
  const retry = useCallback(() => {
    updateState(getIdleState(link));
    setRetryCount((count) => count + 1);
  }, [link, updateState]);
  const result = currentState.result;

  return {
    status: currentState.status,
    comments: result?.comments ?? null,
    remoteDescription: result?.description ?? null,
    creator: result?.creatorName ? {
      name: result.creatorName,
      avatarUrl: result.creatorAvatarUrl,
    } : null,
    isLoading: currentState.status === 'loading',
    loadFailed: currentState.status === 'error',
    retry,
  };
}

function isAbortError(error: unknown): boolean {
  return typeof DOMException !== 'undefined'
    && error instanceof DOMException
    && error.name === 'AbortError';
}
