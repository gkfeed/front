import { useTranslation } from 'react-i18next';

import type {
  FeedCreatorFieldConfig,
} from '../domain/feedCreator';
import type { FeedInput } from '../types';
import { FeedTypePicker } from './FeedTypePicker';

export function FeedCreatorFields({
  id,
  labelledBy,
  fields,
  feed,
  submitted,
  isSaving,
  isFeedFieldValid,
  updateFeed,
}: {
  id: string;
  labelledBy: string;
  fields: readonly FeedCreatorFieldConfig[];
  feed: FeedInput;
  submitted: boolean;
  isSaving: boolean;
  isFeedFieldValid: (field: keyof FeedInput) => boolean;
  updateFeed: (field: keyof FeedInput, value: string) => void;
}) {
  return (
    <div id={id} className="creator__fields" role="tabpanel" aria-labelledby={labelledBy}>
      {fields.map((field) => (
        <FeedCreatorField
          {...field}
          key={field.id}
          value={feed[field.id]}
          invalid={submitted && !isFeedFieldValid(field.id)}
          disabled={isSaving}
          onChange={(value) => updateFeed(field.id, value)}
        />
      ))}
    </div>
  );
}

function FeedCreatorField({
  id,
  labelKey,
  type,
  value,
  placeholderKey,
  errorKey,
  invalid,
  disabled,
  onChange,
}: FeedCreatorFieldConfig & {
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;
  const label = t(labelKey);

  return (
    <div className={`field field--${id}${invalid ? ' field--invalid' : ''}`}>
      {id === 'type' ? (
        <>
          <span id="type-label" className="field__label">{label}</span>
          <FeedTypePicker
            value={value}
            disabled={disabled}
            invalid={invalid}
            errorId={errorId}
            onChange={onChange}
          />
        </>
      ) : (
        <>
          <label className="field__label" htmlFor={id}>{label}</label>
          <div className="field__control">
            <input
              type={type}
              id={id}
              name={id}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              autoComplete={id === 'url' ? 'url' : 'off'}
              placeholder={placeholderKey ? t(placeholderKey) : undefined}
              aria-describedby={invalid ? errorId : undefined}
              aria-invalid={invalid ? 'true' : undefined}
              disabled={disabled}
              required
            />
          </div>
        </>
      )}
      {invalid ? <p id={errorId} className="field__error" role="alert">{t(errorKey)}</p> : null}
    </div>
  );
}
