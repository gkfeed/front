// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, validateCredentials } from '../services/feeds';
import { AuthProvider } from '../state/AuthProvider';
import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { LoginPage } from './LoginPage';

vi.mock('../services/feeds', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/feeds')>(),
  validateCredentials: vi.fn(),
}));

const validateLogin = vi.mocked(validateCredentials);

afterEach(() => {
  cleanup();
  restoreLocalStorage();
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('validates with the server before saving and can clear credentials', async () => {
    const storage = stubLocalStorage();
    validateLogin.mockResolvedValue();
    render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>);

    const signInButton = screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement;
    expect(signInButton.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '  alice  ' } });
    expect(signInButton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    expect(signInButton.disabled).toBe(false);
    fireEvent.click(signInButton);
    expect((await screen.findByText(/Logged in as/)).textContent).toContain('alice');
    expect(validateLogin).toHaveBeenCalledWith({ username: 'alice', password: 'secret' });
    expect(storage.get('gkfeed.credentials')).toBe(JSON.stringify({ username: 'alice', password: 'secret' }));

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(storage.has('gkfeed.credentials')).toBe(true);
    expect(screen.getByText('Are you sure you want to log out?')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(storage.has('gkfeed.credentials')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, log out' }));
    expect(storage.has('gkfeed.credentials')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Username'));
  });

  it('revalidates saved credentials before restoring the login', async () => {
    const storage = stubLocalStorage();
    storage.set('gkfeed.credentials', JSON.stringify({ username: 'alice', password: 'secret' }));
    validateLogin.mockResolvedValue();

    render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>);

    expect(screen.getByRole('status').textContent).toContain('Checking authentication');
    expect((await screen.findByText(/Logged in as/)).textContent).toContain('alice');
  });

  it('rejects invalid credentials without saving them', async () => {
    const storage = stubLocalStorage();
    validateLogin.mockRejectedValue(new ApiError('Request failed with 401', 401));
    render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Invalid username or password.');
    expect(storage.has('gkfeed.credentials')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeTruthy();
  });

  it('removes saved credentials rejected by the server', async () => {
    const storage = stubLocalStorage();
    storage.set('gkfeed.credentials', JSON.stringify({ username: 'alice', password: 'wrong' }));
    validateLogin.mockRejectedValue(new ApiError('Request failed with 401', 401));

    render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeTruthy());
    expect(storage.has('gkfeed.credentials')).toBe(false);
  });

  it('ignores malformed stored credentials', () => {
    const storage = stubLocalStorage();
    storage.set('gkfeed.credentials', JSON.stringify({ username: 'alice' }));

    render(<MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeTruthy();
  });
});
