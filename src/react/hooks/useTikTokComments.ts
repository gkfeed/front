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

type TikTokCommentsRequest = {
  link: string;
  controller: AbortController;
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
  const requestRef = useRef<TikTokCommentsRequest | null>(null);
  const updateState = useCallback((nextState: TikTokCommentsLoadState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  useEffect(() => {
    const currentState = stateRef.current;
    if (!enabled || (currentState.link === link && currentState.status !== 'idle')) return;

    const controller = new AbortController();
    const request: TikTokCommentsRequest = { link, controller };
    requestRef.current = request;
    updateState({ link, status: 'loading', result: null });

    fetchTikTokComments(link, controller.signal)
      .then((result) => {
        if (requestRef.current !== request) return;
        requestRef.current = null;
        updateState({ link, status: 'success', result });
      })
      .catch((error: unknown) => {
        if (requestRef.current !== request) return;
        requestRef.current = null;
        if (!isAbortError(error)) updateState({ link, status: 'error', result: null });
      });

    return () => {
      controller.abort();
      if (requestRef.current !== request) return;
      requestRef.current = null;
      if (stateRef.current.link === link && stateRef.current.status === 'loading') {
        updateState(getIdleState(link));
      }
    };
  }, [enabled, link, retryCount, updateState]);

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
