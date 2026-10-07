import { useEffect } from 'react';

import { pruneLiveCandidateCatalogs } from '../services/liveCandidateCatalog';
import { usePluginPreferences } from '../state/usePluginPreferences';

/** Apply plugin policy even when the Live page is not mounted. */
export function usePluginCatalogPolicy(): void {
  const { disabledPlugins } = usePluginPreferences();
  useEffect(() => {
    const controller = new AbortController();
    if (disabledPlugins.size > 0) void pruneLiveCandidateCatalogs(disabledPlugins, controller.signal);
    return () => controller.abort();
  }, [disabledPlugins]);
}
