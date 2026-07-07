// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../state/AuthContext';
import { LoginPage } from './LoginPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('validates, saves, and clears credentials', () => {
    stubLocalStorage();
    render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Save login' }));
    expect(screen.getByLabelText('Username').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '  alice  ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save login' }));
    expect(screen.getByText(/Logged in as/).textContent).toContain('alice');
    expect(localStorage.getItem('gkfeed.credentials')).toBe(JSON.stringify({ username: 'alice', password: 'secret' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Log out' }));

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(localStorage.getItem('gkfeed.credentials')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Username'));
  });

  it('loads saved credentials from storage', () => {
    stubLocalStorage();
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'alice', password: 'secret' }));

    render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>);

    expect(screen.getByText(/Logged in as/).textContent).toContain('alice');
  });
});

function stubLocalStorage() {
  const values = new Map<string, string>();

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
}
