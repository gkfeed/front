export const themes = [
  { value: 'light', label: 'Light', colorScheme: 'light', browserColor: '#f5f5f4' },
  { value: 'dark', label: 'Dark', colorScheme: 'dark', browserColor: '#211c1b' },
  { value: 'latte', label: 'Catppuccin Latte', colorScheme: 'light', browserColor: '#eff1f5' },
  { value: 'mocha', label: 'Catppuccin Mocha', colorScheme: 'dark', browserColor: '#1e1e2e' },
] as const;

export type Theme = (typeof themes)[number]['value'];

export const THEME_STORAGE_KEY = 'gkfeed.theme';

export function isTheme(value: unknown): value is Theme {
  return themes.some((theme) => theme.value === value);
}

export function getInitialTheme(): Theme {
  const documentTheme = document.documentElement.dataset.theme;
  if (isTheme(documentTheme)) return documentTheme;

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(savedTheme)) return savedTheme;
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }

  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: Theme) {
  const definition = themes.find((candidate) => candidate.value === theme)!;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = definition.colorScheme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', definition.browserColor);
}

export function saveTheme(theme: Theme) {
  applyTheme(theme);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selected theme still applies for this page when storage is unavailable.
  }
}
