import type { FeedPluginId, PluginSettingDefinition } from './feedItemProviderPresentation';

export type PluginSettingsValues = Readonly<Record<string, string | boolean>>;

export function pluginSettingsStorageKey(plugin: { id: FeedPluginId; settingsVersion: number }): string {
  return `gkfeed.pluginSettings.${plugin.id}.v${plugin.settingsVersion}`;
}

export function validatePluginSettings(schema: readonly PluginSettingDefinition[], value: unknown): PluginSettingsValues {
  const values = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return Object.fromEntries(schema.map((field) => [field.id, isPluginSettingValue(field, values[field.id])
    ? values[field.id] as string | boolean
    : field.defaultValue]));
}

export function isPluginSettingValue(field: PluginSettingDefinition, value: unknown): value is string | boolean {
  return field.type === 'boolean' ? typeof value === 'boolean'
    : typeof value === 'string' && field.options.some((option) => option.value === value);
}
