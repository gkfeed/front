import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import type { RemotePreview, RemotePreviewSource } from '../domain/feedItemCardContracts';
import { EMPTY_REMOTE_PREVIEW } from '../domain/remotePreview';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
import { useHltvLiveRefresh } from './useHltvLiveRefresh';
import { useAsyncResource } from './useAsyncResource';
import { usePageVisibility } from './usePageVisibility';
import { usePreviewVisibility } from './usePreviewVisibility';

type RemotePreviewStatus = 'idle' | 'pending' | 'loaded' | 'failed';

export function useFeedItemRemotePreview(
  url: string,
  options: {
    enabled: boolean;
    source: RemotePreviewSource;
    livePreview: 'none' | 'hltv';
    scopeKey?: string;
  },
) {
  const { enabled, source, livePreview: livePreviewMode, scopeKey = '' } = options;
  const { preview: previewUseCases } = useFeatureUseCases();
  const cardRef = useRef<HTMLElement>(null);
  const isVisible = usePreviewVisibility(
    cardRef,
    '400px 0px',
    livePreviewMode === 'hltv' ? 'continuous' : 'once',
  );
  const [hasBeenVisible, setHasBeenVisible] = useState(isVisible);
  useEffect(() => {
    if (isVisible) setHasBeenVisible(true);
  }, [isVisible]);
  const canLoadPreview = isVisible || hasBeenVisible;
  const isPageVisible = usePageVisibility();
  const load = useCallback(
    (signal: AbortSignal) => source === 'none'
      ? Promise.resolve(EMPTY_REMOTE_PREVIEW)
      : previewUseCases.loadRemotePreview(url, source, signal),
    [previewUseCases, source, url],
  );
  const previewKey = `${url}:${source}:${scopeKey}:${enabled}`;
  const resource = useAsyncResource(load, {
    enabled: enabled && canLoadPreview,
    key: previewKey,
  });
  const [livePreview, setLivePreview] = useState<{
    key: string;
    value: RemotePreview;
  } | null>(null);
  const preview = !enabled ? EMPTY_REMOTE_PREVIEW : (livePreview?.key === previewKey ? livePreview.value : null)
    ?? resource.result
    ?? EMPTY_REMOTE_PREVIEW;
  const setPreview = useCallback<Dispatch<SetStateAction<RemotePreview>>>((update) => {
    setLivePreview((previous) => {
      const current = previous?.key === previewKey
        ? previous.value
        : resource.result ?? EMPTY_REMOTE_PREVIEW;
      const value = typeof update === 'function' ? update(current) : update;
      return { key: previewKey, value };
    });
  }, [previewKey, resource.result]);
  const previewStatus: RemotePreviewStatus = !enabled
    ? 'idle'
    : !canLoadPreview
      ? 'pending'
      : resource.status === 'success'
        ? 'loaded'
        : resource.status === 'error'
          ? 'failed'
          : 'pending';

  useHltvLiveRefresh({
    url,
    enabled,
    isVisible: isVisible && isPageVisible,
    isHltv: livePreviewMode === 'hltv',
    currentPreview: preview.openGraphPreview,
    setPreview,
  });

  return { cardRef, previewStatus, ...preview };
}
