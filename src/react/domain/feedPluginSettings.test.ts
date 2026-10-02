import { describe, expect, it } from 'vitest';
import { feedItemProviderResources } from './feedItemProviderPresentation';
import { pluginSettingsStorageKey, validatePluginSettings } from './feedPluginSettings';

describe('plugin settings schema', () => {
  const tiktok = feedItemProviderResources.tiktok;
  it('namespaces settings by stable plugin id and version', () => {
    expect(pluginSettingsStorageKey(tiktok)).toBe('gkfeed.pluginSettings.tiktok.v1');
    expect(pluginSettingsStorageKey({ ...tiktok, settingsVersion: 2 })).toBe('gkfeed.pluginSettings.tiktok.v2');
  });
  it('keeps valid fields, resets invalid fields and discards unknown ones', () => {
    expect(validatePluginSettings(tiktok.settings!, { playbackMode: 'bad', hideItems: true, stale: 1 }))
      .toEqual({ hideItems: true, playbackMode: 'embed' });
    expect(validatePluginSettings(tiktok.settings!, { playbackMode: 'preview', hideItems: 'true' }))
      .toEqual({ hideItems: false, playbackMode: 'preview' });
  });
});
