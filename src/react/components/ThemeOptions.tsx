import { useTranslation } from 'react-i18next';

import {
  themePreferences,
  type ThemePreference,
} from '../theme';

const themeLabelKeys: Record<ThemePreference, string> = {
  system: 'settings.themeSystem',
  'system-catppuccin': 'settings.themeSystemCatppuccin',
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
  latte: 'settings.themeLatte',
  mocha: 'settings.themeMocha',
};

const themeDescriptionKeys: Record<ThemePreference, string> = {
  system: 'settings.descriptionSystem',
  'system-catppuccin': 'settings.descriptionSystemCatppuccin',
  light: 'settings.descriptionLight',
  dark: 'settings.descriptionDark',
  latte: 'settings.descriptionLatte',
  mocha: 'settings.descriptionMocha',
};

const themeAriaLabelKeys: Record<ThemePreference, string> = {
  system: 'settings.themeSystemAria',
  'system-catppuccin': 'settings.themeSystemCatppuccinAria',
  light: 'settings.themeLightAria',
  dark: 'settings.themeDarkAria',
  latte: 'settings.themeLatteAria',
  mocha: 'settings.themeMochaAria',
};

export function ThemeOptions({
  theme,
  onThemeChange,
  onSelect,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onSelect: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="theme-picker__section">
      <span className="theme-picker__section-title">{t('settings.appearance')}</span>
      <div className="theme-picker__options">
        {themePreferences.map((option) => {
          const selected = option.value === theme;
          return (
            <button
              className="theme-picker__option"
              data-theme-option={option.value}
              data-selected={selected || undefined}
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              aria-label={t('settings.theme', { theme: t(themeAriaLabelKeys[option.value]) })}
              onClick={() => {
                onThemeChange(option.value);
                onSelect();
              }}
            >
              <ThemeSwatch theme={option.value} />
              <span className="theme-picker__option-copy">
                <strong>{t(themeLabelKeys[option.value])}</strong>
                <small>{t(themeDescriptionKeys[option.value])}</small>
              </span>
              <span className="theme-picker__check" aria-hidden="true">✓</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemeSwatch({ theme }: { theme: ThemePreference }) {
  return <span className="theme-swatch" data-theme-swatch={theme} aria-hidden="true"><span /></span>;
}
