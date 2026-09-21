// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import {
  DISABLED_PLUGINS_STORAGE_KEY,
  PluginPreferencesProvider,
} from './PluginPreferencesProvider';
import { usePluginPreferences } from './usePluginPreferences';

afterEach(() => {
  cleanup();
  restoreLocalStorage();
});

describe('PluginPreferencesProvider', () => {
  it('persists disabled plugins and enables all of them', () => {
    const storage = stubLocalStorage();
    render(<PluginPreferencesProvider><Probe /></PluginPreferencesProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Twitch' }));
    expect(screen.getByTestId('disabled').textContent).toContain('twitch');
    expect(JSON.parse(storage.get(DISABLED_PLUGINS_STORAGE_KEY)!)).toEqual(['twitch']);

    fireEvent.click(screen.getByRole('button', { name: 'Enable all' }));
    expect(screen.getByTestId('disabled').textContent).toBe('');
  });

  it('ignores unknown stored plugin IDs', () => {
    const storage = stubLocalStorage();
    storage.set(DISABLED_PLUGINS_STORAGE_KEY, JSON.stringify(['removed-plugin', 'youtube']));

    render(<PluginPreferencesProvider><Probe /></PluginPreferencesProvider>);

    expect(screen.getByTestId('disabled').textContent).toContain('youtube');
    expect(screen.getByTestId('disabled').textContent).not.toContain('removed-plugin');
  });
});

function Probe() {
  const { disabledPlugins, setPluginEnabled, enableAllPlugins } = usePluginPreferences();
  return (
    <>
      <span data-testid="disabled">{[...disabledPlugins].join(',')}</span>
      <button type="button" onClick={() => setPluginEnabled('twitch', disabledPlugins.has('twitch'))}>Toggle Twitch</button>
      <button type="button" onClick={enableAllPlugins}>Enable all</button>
    </>
  );
}
