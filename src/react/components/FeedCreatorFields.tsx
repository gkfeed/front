import { useTranslation } from 'react-i18next';

import type {
  FeedCreatorFieldConfig,
  FeedTypeDetectionStatus,
} from '../domain/feedCreator';
import type { FeedInput } from '../types';
import { FeedTypePicker } from './FeedTypePicker';

export function FeedCreatorFields({
  fields,
  feed,
  submitted,
  isSaving,
  detectionStatus,
  isFeedFieldValid,
  updateFeed,
}: {
  fields: readonly FeedCreatorFieldConfig[];
  feed: FeedInput;
  submitted: boolean;
  isSaving: boolean;
  detectionStatus: FeedTypeDetectionStatus;
  isFeedFieldValid: (field: keyof FeedInput) => boolean;
  updateFeed: (field: keyof FeedInput, value: string) => void;
}) {
  return (
    <div className="creator__fields">
      {fields.map((field) => (
        <FeedCreatorField
          {...field}
          key={field.id}
          value={feed[field.id]}
          invalid={submitted && !isFeedFieldValid(field.id)}
          disabled={isSaving}
          detectionStatus={detectionStatus}
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
  detectionStatus,
  onChange,
}: FeedCreatorFieldConfig & {
  value: string;
  invalid: boolean;
  disabled: boolean;
  detectionStatus: FeedTypeDetectionStatus;
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
          <FeedTypeDetectionMessage status={detectionStatus} />
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

function FeedTypeDetectionMessage({ status }: { status: FeedTypeDetectionStatus }) {
  const { t } = useTranslation();
  if (status.state === 'idle') return null;

  const message = status.state === 'detecting'
    ? t('creator.detectingType')
    : status.state === 'success'
    ? t('creator.typeDetected', { confidence: Math.round(status.confidence * 100) })
    : status.state === 'uncertain'
      ? t('creator.typeUncertain')
      : t('creator.typeDetectionError');
  return (
    <p className={`creator__detection creator__detection--${status.state}`} role="status">
      {message}
    </p>
  );
}
