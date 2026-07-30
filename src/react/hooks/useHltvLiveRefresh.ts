import { useEffect, type Dispatch, type SetStateAction } from 'react';

import { getOpenGraphPreview, type OpenGraphPreview } from '../services/openGraph';
import {
  mergeHltvLiveData,
  type RemotePreview,
} from '../services/remotePreview';

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
  useEffect(() => {
    if (
      !enabled
      || !isVisible
      || !isHltv
      || currentPreview?.matchStatus !== 'live'
    ) return;

    let requestInProgress = false;
    const controller = new AbortController();
    const refresh = () => {
      if (requestInProgress) return;
      requestInProgress = true;
      getOpenGraphPreview(url, controller.signal).then((openGraphPreview) => {
        setPreview((previous) => ({
          liquipediaMatch: null,
          openGraphPreview: mergeHltvLiveData(openGraphPreview, previous.openGraphPreview),
        }));
      }).catch(() => {
        // Keep the last known score when a live refresh temporarily fails.
      }).finally(() => {
        requestInProgress = false;
      });
    };
    refresh();
    const interval = window.setInterval(refresh, HLTV_LIVE_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
      controller.abort();
    };
  }, [currentPreview?.matchStatus, enabled, isHltv, isVisible, setPreview, url]);
}
