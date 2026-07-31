import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '../services/feeds';
import type { Credentials } from '../types';

export interface LoginFormState {
  username: string;
  password: string;
}

export type LoginFieldName = keyof LoginFormState;

export interface LoginFormController {
  form: LoginFormState;
  submitted: boolean;
  isValid: boolean;
  isSubmitting: boolean;
  errorMessage: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (name: LoginFieldName, value: string) => void;
}

interface UseLoginFormOptions {
  authenticate: (credentials: Credentials) => Promise<void>;
  onAuthenticated: () => void;
}

const EMPTY_FORM: LoginFormState = { username: '', password: '' };

export function useLoginForm({ authenticate, onAuthenticated }: UseLoginFormOptions): LoginFormController {
  const { t } = useTranslation();
  const [form, setForm] = useState<LoginFormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isValid = Boolean(form.username.trim() && form.password);

  const onSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid) return;

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await authenticate({ ...form, username: form.username.trim() });
      setForm(EMPTY_FORM);
      setSubmitted(false);
      onAuthenticated();
    } catch (error) {
      setErrorMessage(authenticationErrorMessage(error, t));
    } finally {
      setIsSubmitting(false);
    }
  }, [authenticate, form, isValid, onAuthenticated, t]);

  const onChange = useCallback((name: LoginFieldName, value: string) => {
    setErrorMessage('');
    setForm((current) => ({ ...current, [name]: value }));
  }, []);

  return {
    form,
    submitted,
    isValid,
    isSubmitting,
    errorMessage,
    onSubmit,
    onChange,
  };
}

function authenticationErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError && [401, 403].includes(error.status)) {
    return t('auth.invalidCredentials');
  }
  return t('auth.signInError');
}
