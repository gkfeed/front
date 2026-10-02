import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  feedPluginCatalog,
  type FeedPluginId,
} from '../domain/feedItemProviderPresentation';
import { PluginPreferencesContext } from './pluginPreferencesContext';

export const DISABLED_PLUGINS_STORAGE_KEY = 'gkfeed.disabledPlugins.v1';

const knownPluginIds = new Set<FeedPluginId>(feedPluginCatalog.map((plugin) => plugin.id));

export function PluginPreferencesProvider({ children }: { children: ReactNode }) {
  const [disabledPlugins, setDisabledPlugins] = useState(readDisabledPlugins);
  const currentPlugins = useRef(disabledPlugins);

  const persist = useCallback((next: ReadonlySet<FeedPluginId>) => {
    currentPlugins.current = new Set(next);
    setDisabledPlugins(currentPlugins.current);
    try {
      window.localStorage.setItem(DISABLED_PLUGINS_STORAGE_KEY, JSON.stringify([...next].sort()));
    } catch {
      // Keep preferences usable in memory when storage is unavailable.
    }
  }, []);

  const setPluginEnabled = useCallback((pluginId: FeedPluginId, enabled: boolean) => {
    const next = new Set(currentPlugins.current);
    if (enabled) next.delete(pluginId);
    else next.add(pluginId);
    persist(next);
  }, [persist]);

  const enableAllPlugins = useCallback(() => persist(new Set()), [persist]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== DISABLED_PLUGINS_STORAGE_KEY && event.key !== null) return;
      currentPlugins.current = parseDisabledPlugins(event.newValue);
      setDisabledPlugins(currentPlugins.current);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(() => ({
    disabledPlugins,
    isPluginEnabled: (pluginId: FeedPluginId) => !disabledPlugins.has(pluginId),
    setPluginEnabled,
    enableAllPlugins,
  }), [disabledPlugins, enableAllPlugins, setPluginEnabled]);

  return <PluginPreferencesContext value={value}>{children}</PluginPreferencesContext>;
}

function readDisabledPlugins(): ReadonlySet<FeedPluginId> {
  if (typeof window === 'undefined') return new Set();
  try {
    return parseDisabledPlugins(window.localStorage.getItem(DISABLED_PLUGINS_STORAGE_KEY));
  } catch {
    return new Set();
  }
}

function parseDisabledPlugins(value: string | null): ReadonlySet<FeedPluginId> {
  if (!value) return new Set();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is FeedPluginId => (
      typeof id === 'string' && knownPluginIds.has(id as FeedPluginId)
    )));
  } catch {
    return new Set();
  }
}
