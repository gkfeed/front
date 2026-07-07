// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../state/AuthContext';
import { RequireAuth } from './RequireAuth';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RequireAuth', () => {
  it('redirects anonymous users to login without mounting protected content', () => {
    render(
      <MemoryRouter initialEntries={['/create?draft=1']}>
        <AuthProvider>
          <Routes>
            <Route path="/create" element={<RequireAuth><ProtectedContent /></RequireAuth>} />
            <Route path="/login" element={<LoginLocation />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.getByText('Login at /create?draft=1')).toBeTruthy();
  });

  it('renders protected content when credentials are saved', () => {
    stubLocalStorage();
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'alice', password: 'secret' }));

    render(
      <MemoryRouter initialEntries={['/create']}>
        <AuthProvider>
          <Routes>
            <Route path="/create" element={<RequireAuth><ProtectedContent /></RequireAuth>} />
            <Route path="/login" element={<LoginLocation />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Protected content')).toBeTruthy();
  });
});

function ProtectedContent() {
  return <div>Protected content</div>;
}

function LoginLocation() {
  const location = useLocation();
  const from = (location.state as { from: { pathname: string; search: string } }).from;

  return <div>Login at {from.pathname}{from.search}</div>;
}

function stubLocalStorage() {
  const values = new Map<string, string>();

  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
}
