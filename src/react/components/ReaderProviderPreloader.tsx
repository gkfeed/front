import { useEffect, useMemo, useRef } from 'react';

import { getFeedItemProvider } from '../domain/feedItemProviderPresentation';
import { isNsfwLink } from '../domain/nsfw';
import { readerDiagnostic } from '../services/readerDiagnostics';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import { usePluginPreferences } from '../state/usePluginPreferences';
import type { FeedItem } from '../types';
import { feedPluginUiCatalog } from './providers/feedPluginUiCatalog';

/** Warm the presentation modules for the next few review cards. */
export function ReaderProviderPreloader({ enabled, items, activeReviewIds }: {
  enabled: boolean;
  items: FeedItem[];
  activeReviewIds: number[];
}) {
  const { nsfwMode } = useNsfwPreferences();
  const { disabledPlugins } = usePluginPreferences();
  const loaded = useRef<Set<string>>(new Set());
  const upcoming = useMemo(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    return activeReviewIds.slice(1, 4).flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [items, activeReviewIds]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setTimeout(() => {
      for (const item of upcoming) {
        if (nsfwMode !== 'show' && isNsfwLink(item.link)) continue;
        const provider = getFeedItemProvider(item, disabledPlugins);
        if (provider === 'generic' || loaded.current.has(provider)) continue;
        loaded.current.add(provider);
        readerDiagnostic('ui-prefetch-start', item.id, provider);
        void feedPluginUiCatalog[provider].loadUi().then(() => {
          readerDiagnostic('ui-prefetch-ready', item.id, provider);
        }).catch(() => {
          loaded.current.delete(provider);
          readerDiagnostic('ui-prefetch-error', item.id, provider);
        });
      }
    }, 10);
    return () => window.clearTimeout(timer);
  }, [enabled, upcoming, nsfwMode, disabledPlugins]);

  return null;
}
