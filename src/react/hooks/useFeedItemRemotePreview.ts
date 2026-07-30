import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import {
  getLiquipediaMatchPreview,
  type LiquipediaMatchPreview,
} from '../services/liquipedia';
import {
  getOpenGraphPreview,
  type OpenGraphPreview,
} from '../services/openGraph';
import { loadQueuedPreview } from '../services/previewQueue';

type RemotePreview = {
  liquipediaMatch: LiquipediaMatchPreview | null;
  openGraphPreview: OpenGraphPreview | null;
};

type RemotePreviewStatus = 'idle' | 'pending' | 'loaded' | 'failed';

const HLTV_LIVE_REFRESH_MS = 30_000;

const EMPTY_PREVIEW: RemotePreview = {
  liquipediaMatch: null,
  openGraphPreview: null,
};

export function useFeedItemRemotePreview(
  url: string,
  enabled: boolean,
  isLiquipedia: boolean,
  isHltv = false,
) {
  const cardRef = useRef<HTMLElement>(null);
  const isVisible = usePreviewVisibility(cardRef);
  const [preview, setPreview] = useState<RemotePreview>(EMPTY_PREVIEW);
  const [status, setStatus] = useState<RemotePreviewStatus>(
    () => enabled ? 'pending' : 'idle',
  );

  useEffect(() => {
    let active = true;
    setPreview(EMPTY_PREVIEW);
    if (!enabled) {
      setStatus('idle');
      return;
    }

    setStatus('pending');
    if (!isVisible) return;

    loadRemotePreview(url, isLiquipedia).then((result) => {
      if (active) {
        setPreview(result);
        setStatus('loaded');
      }
    }).catch(() => {
      if (active) setStatus('failed');
    });

    return () => {
      active = false;
    };
  }, [enabled, isLiquipedia, isVisible, url]);

  useEffect(() => {
    if (
      !enabled
      || !isVisible
      || !isHltv
      || preview.openGraphPreview?.matchStatus !== 'live'
    ) return;

    let requestInProgress = false;
    const controller = new AbortController();
    const refresh = () => {
      if (requestInProgress) return;
      requestInProgress = true;
      getOpenGraphPreview(url, controller.signal).then((openGraphPreview) => {
        setPreview((previous) => ({
          liquipediaMatch: null,
          openGraphPreview: retainHltvCurrentMap(openGraphPreview, previous.openGraphPreview),
        }));
      }).catch(() => {
        // Keep the last known score when a live refresh temporarily fails.
      }).finally(() => {
        requestInProgress = false;
      });
    };
    const interval = window.setInterval(refresh, HLTV_LIVE_REFRESH_MS);

    return () => {
      window.clearInterval(interval);
      controller.abort();
    };
  }, [enabled, isHltv, isVisible, preview.openGraphPreview?.matchStatus, url]);

  return { cardRef, previewStatus: status, ...preview };
}

function retainHltvCurrentMap(
  next: OpenGraphPreview,
  previous: OpenGraphPreview | null,
): OpenGraphPreview {
  if (
    next.matchStatus !== 'live'
    || next.matchCurrentMap
    || !previous?.matchCurrentMap
    || !sameMatchScore(next.matchScore, previous.matchScore)
  ) return next;

  return { ...next, matchCurrentMap: previous.matchCurrentMap };
}

function sameMatchScore(
  first: OpenGraphPreview['matchScore'],
  second: OpenGraphPreview['matchScore'],
): boolean {
  return Boolean(
    first
    && second
    && first[0] === second[0]
    && first[1] === second[1],
  );
}

async function loadRemotePreview(url: string, isLiquipedia: boolean): Promise<RemotePreview> {
  if (isLiquipedia) {
    try {
      const liquipediaMatch = await loadQueuedPreview(
        `liquipedia:${url}`,
        (signal) => getLiquipediaMatchPreview(url, signal),
      );
      return { liquipediaMatch, openGraphPreview: null };
    } catch {
      // Unsupported or changed Liquipedia markup still gets a generic preview.
    }
  }

  const openGraphPreview = await loadQueuedPreview(
    `open-graph:${url}`,
    (signal) => getOpenGraphPreview(url, signal),
  );
  return { liquipediaMatch: null, openGraphPreview };
}

function usePreviewVisibility(ref: RefObject<HTMLElement | null>): boolean {
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '400px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return isVisible;
}
