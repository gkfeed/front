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

const EMPTY_PREVIEW: RemotePreview = {
  liquipediaMatch: null,
  openGraphPreview: null,
};

export function useFeedItemRemotePreview(
  url: string,
  enabled: boolean,
  isLiquipedia: boolean,
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

  return { cardRef, previewStatus: status, ...preview };
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
