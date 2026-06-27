import { useState } from 'react';
import type { FormEvent } from 'react';

import { LockIcon, UserIcon } from '../components/Icons';
import { useAuth } from '../state/AuthContext';

const EMPTY_FORM = { username: '', password: '' };
const FIELDS = [
  { name: 'username', label: 'Username', type: 'text', autoComplete: 'username', placeholder: 'gakawarstone', Icon: UserIcon },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password', placeholder: undefined, Icon: LockIcon },
] as const;

export function LoginPage() {
  const { credentials, saveCredentials, clearCredentials } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const savedUsername = credentials?.username ?? '';
  const isValid = Boolean(form.username.trim() && form.password);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid) return;

    saveCredentials({ ...form, username: form.username.trim() });
    setForm(EMPTY_FORM);
    setSubmitted(false);
  }

  return (
    <section className="login" aria-labelledby="login-title">
      {savedUsername ? (
        <div className="login__form login__form--saved">
          <header className="login__header">
            <h1 id="login-title">Account access</h1>
          </header>
          <div className="field__control" role="status">
            <span className="field__icon" aria-hidden="true"><UserIcon /></span>
            <span>Logged in as <strong>{savedUsername}</strong></span>
          </div>
          <div className="login__actions">
            <button type="button" className="danger" onClick={clearCredentials} autoFocus>Log out</button>
          </div>
        </div>
      ) : (
        <form className="login__form" onSubmit={onSubmit} noValidate>
          <header className="login__header">
            <p className="login__eyebrow">Account access</p>
            <h1 id="login-title">Sign in to GKFEED</h1>
          </header>
          <div className="login__fields">
            {FIELDS.map(({ name, label, Icon, ...inputProps }) => {
              const invalid = submitted && !form[name].trim();
              const helpId = `${name}-help`;
              const errorId = `${name}-error`;

              return (
                <div className="field" key={name}>
                  <label htmlFor={name}>{label}</label>
                  <div className="field__control">
                    <span className="field__icon" aria-hidden="true"><Icon /></span>
                    <input
                      {...inputProps}
                      id={name}
                      name={name}
                      value={form[name]}
                      onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
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
            })}
          </div>
          <div className="login__actions">
            <span className="login__status" aria-live="polite">{isValid ? 'Ready to save' : 'Enter credentials'}</span>
            <button type="submit">Save login</button>
          </div>
        </form>
      )}
    </section>
  );
}
