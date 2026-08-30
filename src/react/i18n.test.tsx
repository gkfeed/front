// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { LoginPage } from './pages/LoginPage';
import { AppProviders } from './state/AppProviders';
import { i18n, resolveLanguage } from './i18n';

afterEach(async () => {
  cleanup();
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

describe('i18n', () => {
  it('maps Russian locales to Russian and all other locales to English', () => {
    expect(resolveLanguage('ru')).toBe('ru');
    expect(resolveLanguage('ru-RU')).toBe('ru');
    expect(resolveLanguage('ru-KZ')).toBe('ru');
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('de-DE')).toBe('en');
    expect(resolveLanguage('russian')).toBe('en');
    expect(resolveLanguage(undefined)).toBe('en');
  });

  it('renders the login UI in both supported languages', async () => {
    const renderLogin = () => render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <AppProviders>
            <LoginPage />
          </AppProviders>
        </MemoryRouter>
      </I18nextProvider>,
    );

    await act(async () => {
      await i18n.changeLanguage('ru');
    });
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Вход в GKFEED' })).toBeTruthy();
    expect(screen.getByLabelText('Имя пользователя')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeTruthy();

    cleanup();
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeTruthy();
    expect(screen.getByLabelText('Username')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });
});
