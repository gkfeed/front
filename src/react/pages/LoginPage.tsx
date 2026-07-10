import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { LockIcon, UserIcon } from '../components/Icons';
import { useAuth } from '../state/AuthContext';
import { getRedirectTarget } from '../state/routes';

const EMPTY_FORM = { username: '', password: '' };
type LoginFormState = typeof EMPTY_FORM;
type LoginFieldName = keyof LoginFormState;

const FIELDS = [
  { name: 'username', label: 'Username', type: 'text', autoComplete: 'username', placeholder: 'gakawarstone', Icon: UserIcon },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password', placeholder: undefined, Icon: LockIcon },
] as const;

export function LoginPage() {
  const { credentials, saveCredentials, clearCredentials } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const savedUsername = credentials?.username ?? '';
  const isValid = Boolean(form.username.trim() && form.password);
  const redirectTo = getRedirectTarget(location.state);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid) return;

    saveCredentials({ ...form, username: form.username.trim() });
    setForm(EMPTY_FORM);
    setSubmitted(false);
    navigate(redirectTo, { replace: true });
  }

  return (
    <section className="login" aria-labelledby="login-title">
      {savedUsername ? (
        <SavedLogin username={savedUsername} onLogout={clearCredentials} />
      ) : (
        <LoginForm
          form={form}
          submitted={submitted}
          isValid={isValid}
          onSubmit={onSubmit}
          onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
        />
      )}
    </section>
  );
}

function SavedLogin({ username, onLogout }: { username: string; onLogout: () => void }) {
  return (
    <div className="login__form login__form--saved">
      <h1 id="login-title" className="page-title">Signed in to GKFEED</h1>
      <div className="login__account" role="status">
        <span className="field__icon" aria-hidden="true"><UserIcon /></span>
        <span className="login__account-copy">
          Logged in as <strong>{username}</strong>
        </span>
      </div>
      <div className="login__actions">
        <button type="button" className="danger" onClick={onLogout} autoFocus>Log out</button>
      </div>
    </div>
  );
}

function LoginForm({
  form,
  submitted,
  isValid,
  onSubmit,
  onChange,
}: {
  form: LoginFormState;
  submitted: boolean;
  isValid: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (name: LoginFieldName, value: string) => void;
}) {
  return (
    <form className="login__form" onSubmit={onSubmit} noValidate>
      <h1 id="login-title" className="page-title">Sign in to GKFEED</h1>
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
      <div className="login__actions">
        <span className="login__status" aria-live="polite">{isValid ? 'Ready to save' : 'Enter credentials'}</span>
        <button type="submit">Save login</button>
      </div>
    </form>
  );
}

function LoginField({
  field: { name, label, Icon, ...inputProps },
  value,
  invalid,
  onChange,
}: {
  field: (typeof FIELDS)[number];
  value: string;
  invalid: boolean;
  onChange: (name: LoginFieldName, value: string) => void;
}) {
  const helpId = `${name}-help`;
  const errorId = `${name}-error`;

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
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
      <p id={helpId} className="field__hint">Required. Enter your {name}.</p>
      {invalid ? <p id={errorId} className="field__error" role="alert">Enter your {name}.</p> : null}
    </div>
  );
}

function isFieldEmpty(value: string): boolean {
  return !value.trim();
}
