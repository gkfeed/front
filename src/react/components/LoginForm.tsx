import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { LockIcon, UserIcon } from './Icons';
import type { LoginFieldName, LoginFormState } from '../hooks/useLoginForm';

const FIELDS = [
  { name: 'username', labelKey: 'auth.username', type: 'text', autoComplete: 'username', Icon: UserIcon },
  { name: 'password', labelKey: 'auth.password', type: 'password', autoComplete: 'current-password', Icon: LockIcon },
] as const;

export function LoginForm({
  form,
  submitted,
  isValid,
  isSubmitting,
  errorMessage,
  onSubmit,
  onChange,
}: {
  form: LoginFormState;
  submitted: boolean;
  isValid: boolean;
  isSubmitting: boolean;
  errorMessage: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (name: LoginFieldName, value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <form className="login__form" onSubmit={onSubmit} noValidate>
      <h1 id="login-title" className="page-title">{t('auth.signInTitle')}</h1>
      <div className="login__fields">
        {FIELDS.map((field) => (
          <LoginField
            key={field.name}
            field={field}
            value={form[field.name]}
            invalid={submitted && isFieldEmpty(form[field.name])}
            onChange={onChange}
          />
        ))}
      </div>
      {errorMessage ? <p className="field__error" role="alert">{errorMessage}</p> : null}
      <div className="login__actions">
        <button className="ui-primary-button" type="submit" disabled={!isValid || isSubmitting}>{isSubmitting ? t('auth.signingIn') : t('auth.signIn')}</button>
      </div>
    </form>
  );
}

function LoginField({
  field: { name, labelKey, Icon, ...inputProps },
  value,
  invalid,
  onChange,
}: {
  field: (typeof FIELDS)[number];
  value: string;
  invalid: boolean;
  onChange: (name: LoginFieldName, value: string) => void;
}) {
  const { t } = useTranslation();
  const helpId = `${name}-help`;
  const errorId = `${name}-error`;

  return (
    <div className={`field${invalid ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={name}>{t(labelKey)}</label>
      <div className="field__control">
        <span className="field__icon" aria-hidden="true"><Icon /></span>
        <input
          {...inputProps}
          id={name}
          name={name}
          value={value}
          onChange={(event) => onChange(name, event.target.value)}
          autoFocus={name === 'username'}
          aria-describedby={`${helpId}${invalid ? ` ${errorId}` : ''}`}
          aria-invalid={invalid || undefined}
          required
        />
      </div>
      <p id={helpId} className="field__hint">{t('auth.required', { field: t(labelKey).toLocaleLowerCase() })}</p>
      {invalid ? <p id={errorId} className="field__error" role="alert">{t('auth.enter', { field: t(labelKey).toLocaleLowerCase() })}</p> : null}
    </div>
  );
}

function isFieldEmpty(value: string): boolean {
  return !value.trim();
}
