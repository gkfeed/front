import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { OpenGraphPreview } from '../../../shared/previewContracts';
import { getOpenGraphPreview } from '../services/openGraph';
import { mergeHltvLiveData } from '../services/remotePreview';
import type { RemotePreview } from '../domain/feedItemCardContracts';
import { useAsyncResource } from './useAsyncResource';

const HLTV_LIVE_REFRESH_MS = 30_000;

export function useHltvLiveRefresh({
  url,
  enabled,
  isVisible,
  isHltv,
  currentPreview,
  setPreview,
}: {
  url: string;
  enabled: boolean;
  isVisible: boolean;
  isHltv: boolean;
  currentPreview: OpenGraphPreview | null;
  setPreview: Dispatch<SetStateAction<RemotePreview>>;
}): void {
  const refreshEnabled = enabled
    && isVisible
    && isHltv
    && currentPreview?.providerData?.provider === 'hltv'
    && currentPreview.providerData.snapshot.status === 'live';
  const load = useCallback(
    (signal: AbortSignal) => getOpenGraphPreview(url, signal),
    [url],
  );
  const { result, isLoading, retry } = useAsyncResource<OpenGraphPreview>(load, {
    enabled: refreshEnabled,
    key: url,
  });
  const isLoadingRef = useRef(isLoading);
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (!result) return;
    setPreview((previous) => ({
      liquipediaMatch: null,
      openGraphPreview: mergeHltvLiveData(result, previous.openGraphPreview),
    }));
  }, [result, setPreview]);

  useEffect(() => {
    if (!refreshEnabled) return undefined;
    const interval = window.setInterval(() => {
      if (!isLoadingRef.current) retry();
    }, HLTV_LIVE_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refreshEnabled, retry]);
}
