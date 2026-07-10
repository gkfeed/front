// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../state/AuthContext';
import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { LoginPage } from './LoginPage';

afterEach(() => {
  cleanup();
  restoreLocalStorage();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('validates, saves, and clears credentials', () => {
    const storage = stubLocalStorage();
    render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Save login' }));
    expect(screen.getByLabelText('Username').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '  alice  ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save login' }));
    expect(screen.getByText(/Logged in as/).textContent).toContain('alice');
    expect(storage.get('gkfeed.credentials')).toBe(JSON.stringify({ username: 'alice', password: 'secret' }));

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(storage.has('gkfeed.credentials')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Username'));
  });

  it('loads saved credentials from storage', () => {
    const storage = stubLocalStorage();
    storage.set('gkfeed.credentials', JSON.stringify({ username: 'alice', password: 'secret' }));

    render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>);

    expect(screen.getByText(/Logged in as/).textContent).toContain('alice');
  });

  it('ignores malformed stored credentials', () => {
    const storage = stubLocalStorage();
    storage.set('gkfeed.credentials', JSON.stringify({ username: 'alice' }));

    render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeTruthy();
  });
});
