import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { feedPluginCatalog, type FeedPluginId } from '../domain/feedItemProviderPresentation';
import { isPluginSettingValue, pluginSettingsStorageKey, validatePluginSettings, type PluginSettingsValues } from '../domain/feedPluginSettings';
import { PluginSettingsContext } from './pluginSettingsContext';

const configurablePlugins = feedPluginCatalog.filter((plugin) => plugin.settings?.length);
type ConfigurablePlugin = typeof configurablePlugins[number];
type SettingsState = Partial<Record<FeedPluginId, PluginSettingsValues>>;

export function PluginSettingsProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<SettingsState>(() => Object.fromEntries(
    configurablePlugins.map((plugin) => [plugin.id, readSettings(plugin)]),
  ));
  const currentValues = useRef(values);
  const setValue = useCallback((pluginId: FeedPluginId, fieldId: string, value: string | boolean) => {
    const plugin = configurablePlugins.find((entry) => entry.id === pluginId);
    const field = plugin?.settings?.find((entry) => entry.id === fieldId);
    if (!plugin || !field || !isPluginSettingValue(field, value)) return;
    const settings = { ...currentValues.current[pluginId], [fieldId]: value };
    currentValues.current = { ...currentValues.current, [pluginId]: settings };
    setValues(currentValues.current);
    writeSettings(plugin, settings);
  }, []);

  useEffect(() => {
    // Normalize and migrate after mount; initializers remain read-only.
    configurablePlugins.forEach((plugin) => writeSettings(plugin, currentValues.current[plugin.id] ?? {}));
    const onStorage = (event: StorageEvent) => {
      const changed = configurablePlugins.filter((plugin) => event.key === null || event.key === pluginSettingsStorageKey(plugin));
      if (!changed.length) return;
      const next = { ...currentValues.current };
      changed.forEach((plugin) => { next[plugin.id] = readSettings(plugin); });
      currentValues.current = next;
      setValues(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const context = useMemo(() => ({ values, setValue }), [values, setValue]);
  return <PluginSettingsContext value={context}>{children}</PluginSettingsContext>;
}

function readSettings(plugin: ConfigurablePlugin): PluginSettingsValues {
  const schema = plugin.settings ?? [];
  if (typeof window === 'undefined') return validatePluginSettings(schema, {});
  try {
    const stored = window.localStorage.getItem(pluginSettingsStorageKey(plugin));
    if (stored !== null) {
      try { return validatePluginSettings(schema, JSON.parse(stored)); }
      catch { return validatePluginSettings(schema, {}); }
    }
    const legacy = Object.fromEntries(schema.map((field) => {
      const value = field.legacyStorageKey ? window.localStorage.getItem(field.legacyStorageKey) : null;
      return [field.id, field.type === 'boolean' && value !== null ? value === 'true' : value];
    }));
    return validatePluginSettings(schema, legacy);
  } catch {
    return validatePluginSettings(schema, {});
  }
}

function writeSettings(plugin: ConfigurablePlugin, settings: PluginSettingsValues): void {
  try {
    window.localStorage.setItem(pluginSettingsStorageKey(plugin), JSON.stringify(settings));
    plugin.settings?.forEach((field) => {
      if (field.legacyStorageKey) window.localStorage.removeItem(field.legacyStorageKey);
    });
  } catch {
    // Preserve legacy keys on a failed migration and keep the in-memory values.
  }
}
