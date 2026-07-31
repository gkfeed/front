import { SettingsMenu, type SettingsMenuProps } from './SettingsMenu';

/** @deprecated Use SettingsMenu for the complete settings control. */
export function ThemePicker(props: SettingsMenuProps) {
  return <SettingsMenu {...props} />;
}

export type { SettingsMenuProps as ThemePickerProps };
