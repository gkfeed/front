// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, validateCredentials } from '../services/feeds';
import { AuthProvider } from '../state/AuthProvider';
import { getRouteLocation } from '../state/routes';
import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { RequireAuth } from './RequireAuth';

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

  it('renders protected content only after saved credentials are accepted', async () => {
    const storage = stubLocalStorage();
    storage.set('gkfeed.credentials', JSON.stringify({ username: 'alice', password: 'secret' }));
    validateLogin.mockResolvedValue();

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

    expect(screen.queryByText('Protected content')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Checking authentication');
    expect(await screen.findByText('Protected content')).toBeTruthy();
  });

  it('redirects when saved credentials are rejected by the server', async () => {
    const storage = stubLocalStorage();
    storage.set('gkfeed.credentials', JSON.stringify({ username: 'alice', password: 'wrong' }));
    validateLogin.mockRejectedValue(new ApiError('Request failed with 401', 401));

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

    expect(await screen.findByText('Login at /create')).toBeTruthy();
    expect(screen.queryByText('Protected content')).toBeNull();
    expect(storage.has('gkfeed.credentials')).toBe(false);
  });
});

function ProtectedContent() {
  return <div>Protected content</div>;
}

function LoginLocation() {
  const location = useLocation();
  const from = getRouteLocation(location.state);

  return <div>Login at {from?.pathname}{from?.search}</div>;
}
