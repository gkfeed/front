export const themes = [
  { value: 'light', label: 'Light', colorScheme: 'light', browserColor: '#f5f5f4' },
  { value: 'dark', label: 'Dark', colorScheme: 'dark', browserColor: '#211c1b' },
  { value: 'latte', label: 'Catppuccin Latte', colorScheme: 'light', browserColor: '#eff1f5' },
  { value: 'mocha', label: 'Catppuccin Mocha', colorScheme: 'dark', browserColor: '#1e1e2e' },
] as const;

export type Theme = (typeof themes)[number]['value'];
export type ThemePreference = Theme | 'system' | 'system-catppuccin';

export const themePreferences = [
  { value: 'system', label: 'System' },
  { value: 'system-catppuccin', label: 'System Catppuccin' },
  ...themes,
] satisfies ReadonlyArray<{ value: ThemePreference; label: string }>;

export const THEME_STORAGE_KEY = 'gkfeed.theme';

export function isTheme(value: unknown): value is Theme {
  return themes.some((theme) => theme.value === value);
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'system-catppuccin' || isTheme(value);
}

export function getInitialThemePreference(): ThemePreference {
  const documentPreference = document.documentElement.dataset.themePreference;
  if (isThemePreference(documentPreference)) return documentPreference;

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(savedTheme)) return savedTheme;
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }

  const documentTheme = document.documentElement.dataset.theme;
  return isTheme(documentTheme) ? documentTheme : 'system';
}

export function applyTheme(theme: Theme) {
  const definition = themes.find((candidate) => candidate.value === theme)!;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = definition.colorScheme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', definition.browserColor);
}

export function applyThemePreference(preference: ThemePreference) {
  document.documentElement.dataset.themePreference = preference;
  applyTheme(isSystemPreference(preference) ? getSystemTheme(preference) : preference);
}

export function getSystemTheme(preference: 'system' | 'system-catppuccin' = 'system'): Theme {
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  if (preference === 'system-catppuccin') return prefersLight ? 'latte' : 'mocha';
  return prefersLight ? 'light' : 'dark';
}

export function isSystemPreference(
  preference: ThemePreference,
): preference is 'system' | 'system-catppuccin' {
  return preference === 'system' || preference === 'system-catppuccin';
}

export function saveTheme(preference: ThemePreference) {
  applyThemePreference(preference);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The selected theme still applies for this page when storage is unavailable.
  }
}
