import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { FeedPluginId, PluginSettingDefinition } from '../domain/feedItemProviderPresentation';
import type { PluginSettingsValues } from '../domain/feedPluginSettings';
import { usePluginSettings } from '../state/usePluginSettings';
import { TikTokPicker } from './TikTokPicker';
import { TikTokPlaybackPicker } from './TikTokPlaybackPicker';

export type PluginSettingsControlProps = {
  value: PluginSettingsValues;
  setValue: (fieldId: string, value: string | boolean) => void;
  disabled: boolean;
  t: TFunction;
};

const customSettingsControls: Partial<Record<FeedPluginId, (props: PluginSettingsControlProps) => React.ReactNode>> = {
  tiktok: () => <><TikTokPicker /><TikTokPlaybackPicker /></>,
};

export function PluginSettingsFields({ pluginId, schema, disabled }: {
  pluginId: FeedPluginId;
  schema: readonly PluginSettingDefinition[];
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { values, setValue } = usePluginSettings(pluginId);
  const CustomControls = customSettingsControls[pluginId];
  return (
    <fieldset className="plugin-settings__nested" disabled={disabled}>
      {CustomControls ? <CustomControls value={values} setValue={setValue} disabled={disabled} t={t} /> : schema.map((field) => (
        <label className="plugin-settings__toggle" key={field.id}>
          <span>{t(field.labelKey)}</span>
          {field.type === 'boolean' ? (
            <input type="checkbox" checked={values[field.id] === true} onChange={(event) => setValue(field.id, event.target.checked)} />
          ) : (
            <select value={String(values[field.id] ?? field.defaultValue)} onChange={(event) => setValue(field.id, event.target.value)}>
              {field.options.map((option) => <option key={option.value} value={option.value}>{t(option.labelKey)}</option>)}
            </select>
          )}
        </label>
      ))}
    </fieldset>
  );
}
