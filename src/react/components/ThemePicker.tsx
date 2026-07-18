import { useState } from 'react';

import { getInitialTheme, saveTheme, themes, type Theme } from '../theme';

export function ThemePicker() {
  const [theme, setTheme] = useState(getInitialTheme);

  return (
    <label className="theme-picker">
      <span className="sr-only">Color theme</span>
      <span className="theme-picker__icon" aria-hidden="true">◐</span>
      <select
        className="theme-picker__select"
        aria-label="Color theme"
        value={theme}
        onChange={(event) => {
          const nextTheme = event.target.value as Theme;
          setTheme(nextTheme);
          saveTheme(nextTheme);
        }}
      >
        {themes.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
