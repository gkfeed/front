// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AuthProvider } from '../state/AuthContext';
import { LoginPage } from './LoginPage';

afterEach(cleanup);

describe('LoginPage', () => {
  it('validates, saves, and clears credentials', () => {
    render(<AuthProvider><LoginPage /></AuthProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Save login' }));
    expect(screen.getByLabelText('Username').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '  alice  ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save login' }));
    expect(screen.getByText(/Logged in as/).textContent).toContain('alice');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Log out' }));

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(screen.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Username'));
  });
});
