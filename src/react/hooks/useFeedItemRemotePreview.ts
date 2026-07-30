import { useEffect, useRef, useState } from 'react';

import {
  EMPTY_REMOTE_PREVIEW,
  loadRemotePreview,
  type RemotePreview,
} from '../services/remotePreview';
import { useHltvLiveRefresh } from './useHltvLiveRefresh';
import { usePreviewVisibility } from './usePreviewVisibility';

type RemotePreviewStatus = 'idle' | 'pending' | 'loaded' | 'failed';

export function useFeedItemRemotePreview(
  url: string,
  enabled: boolean,
  isLiquipedia: boolean,
  isHltv = false,
) {
  const cardRef = useRef<HTMLElement>(null);
  const isVisible = usePreviewVisibility(cardRef);
  const [preview, setPreview] = useState<RemotePreview>(EMPTY_REMOTE_PREVIEW);
  const [status, setStatus] = useState<RemotePreviewStatus>(() => enabled ? 'pending' : 'idle');

  useEffect(() => {
    let active = true;
    setPreview(EMPTY_REMOTE_PREVIEW);
    if (!enabled) {
      setStatus('idle');
      return;
    }

    setStatus('pending');
    if (!isVisible) return;

    const controller = new AbortController();
    loadRemotePreview(url, isLiquipedia, controller.signal).then((result) => {
      if (active) {
        setPreview(result);
        setStatus('loaded');
      }
    }).catch(() => {
      if (active) setStatus('failed');
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, isLiquipedia, isVisible, url]);

  useHltvLiveRefresh({
    url,
    enabled,
    isVisible,
    isHltv,
    currentPreview: preview.openGraphPreview,
    setPreview,
  });

  return { cardRef, previewStatus: status, ...preview };
}
