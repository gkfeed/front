// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import {
  HIDE_TIKTOK_ITEMS_STORAGE_KEY, TIKTOK_PLAYBACK_MODE_STORAGE_KEY, TIKTOK_PLUGIN_SETTINGS_STORAGE_KEY,
  TikTokPreferencesProvider,
} from './TikTokPreferencesProvider';
import { useTikTokPreferences } from './useTikTokPreferences';

afterEach(() => { cleanup(); vi.restoreAllMocks(); restoreLocalStorage(); });

describe('TikTok plugin preferences', () => {
  it('migrates both legacy fields after mount and removes old keys after a successful write', () => {
    const storage = stubLocalStorage();
    storage.set(HIDE_TIKTOK_ITEMS_STORAGE_KEY, 'true');
    storage.set(TIKTOK_PLAYBACK_MODE_STORAGE_KEY, 'preview');
    const { result } = renderHook(useTikTokPreferences, { wrapper: TikTokPreferencesProvider });
    expect(result.current.playbackMode).toBe('preview');
    expect(result.current.hideTikTokItems).toBe(true);
    expect(JSON.parse(storage.get(TIKTOK_PLUGIN_SETTINGS_STORAGE_KEY)!)).toEqual({ playbackMode: 'preview', hideItems: true });
    expect(storage.has(HIDE_TIKTOK_ITEMS_STORAGE_KEY)).toBe(false);
    expect(storage.has(TIKTOK_PLAYBACK_MODE_STORAGE_KEY)).toBe(false);
  });

  it('retains in-memory fields while storage is unavailable and persists both when it recovers', () => {
    const storage = stubLocalStorage();
    const { result } = renderHook(useTikTokPreferences, { wrapper: TikTokPreferencesProvider });
    const write = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('storage blocked'); });
    act(() => result.current.setPlaybackMode('preview'));
    write.mockRestore();
    act(() => result.current.setHideTikTokItems(true));
    expect(result.current.playbackMode).toBe('preview');
    expect(JSON.parse(storage.get(TIKTOK_PLUGIN_SETTINGS_STORAGE_KEY)!)).toEqual({ playbackMode: 'preview', hideItems: true });
  });

  it('does not remove legacy preferences when migration persistence fails', () => {
    const storage = stubLocalStorage();
    storage.set(TIKTOK_PLAYBACK_MODE_STORAGE_KEY, 'preview');
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const { result } = renderHook(useTikTokPreferences, { wrapper: TikTokPreferencesProvider });
    expect(result.current.playbackMode).toBe('preview');
    expect(storage.get(TIKTOK_PLAYBACK_MODE_STORAGE_KEY)).toBe('preview');
  });

  it('resets only an invalid field', () => {
    const storage = stubLocalStorage();
    storage.set(TIKTOK_PLUGIN_SETTINGS_STORAGE_KEY, JSON.stringify({ playbackMode: 'bad', hideItems: true }));
    const { result } = renderHook(useTikTokPreferences, { wrapper: TikTokPreferencesProvider });
    expect(result.current.playbackMode).toBe('embed');
    expect(result.current.hideTikTokItems).toBe(true);
  });
});
