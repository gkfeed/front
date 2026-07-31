import { useCallback, useEffect, useState } from 'react';

import {
  applyTheme,
  getInitialThemePreference,
  isSystemPreference,
  saveTheme,
  type ThemePreference,
} from '../theme';

export function useThemePreference() {
  const [selectedTheme, setSelectedTheme] = useState(getInitialThemePreference);
  useSystemTheme(selectedTheme);

  const selectTheme = useCallback((nextTheme: ThemePreference) => {
    setSelectedTheme(nextTheme);
    saveTheme(nextTheme);
  }, []);

  return { theme: selectedTheme, selectTheme };
}

function useSystemTheme(theme: ThemePreference) {
  useEffect(() => {
    if (!isSystemPreference(theme)) return;

    const systemTheme = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!systemTheme) return;
    const syncTheme = () => {
      if (theme === 'system-catppuccin') {
        applyTheme(systemTheme.matches ? 'latte' : 'mocha');
      } else {
        applyTheme(systemTheme.matches ? 'light' : 'dark');
      }
    };
    syncTheme();
    systemTheme.addEventListener('change', syncTheme);
    return () => systemTheme.removeEventListener('change', syncTheme);
  }, [theme]);
}
