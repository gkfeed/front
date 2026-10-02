// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { createAuthUseCases } from '../features/auth/authUseCaseFactory';
import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { AUTH_STORAGE_KEY } from './authStorage';
import { useAuthSession } from './authSession';

const firstCredentials = { username: 'first', password: 'one' };
const secondCredentials = { username: 'second', password: 'two' };

afterEach(() => {
  cleanup();
  restoreLocalStorage();
});

function pendingValidation() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createPendingSession() {
  const pending = pendingValidation();
  const validateCredentials = vi.fn()
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValue(undefined);
  const auth = createAuthUseCases({
    validateCredentials,
    isAuthenticationError: (error) => error instanceof Error && error.message === 'unauthorized',
  });
  return { pending, auth };
}

it('keeps the newer login when an older validation finishes later', async () => {
  const storage = stubLocalStorage();
  const { pending, auth } = createPendingSession();
  const { result } = renderHook(() => useAuthSession(auth));
  const first = result.current.authenticate(firstCredentials);
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });

  await act(async () => { await result.current.authenticate(secondCredentials); });
  await act(async () => { pending.resolve(); await rejected; });

  expect(result.current.credentials).toEqual(secondCredentials);
  expect(storage.get(AUTH_STORAGE_KEY)).toBe(JSON.stringify(secondCredentials));
});

it('keeps logout effective when a pending login finishes later', async () => {
  const storage = stubLocalStorage();
  const { pending, auth } = createPendingSession();
  const { result } = renderHook(() => useAuthSession(auth));
  const first = result.current.authenticate(firstCredentials);
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });

  await act(async () => { await result.current.authenticate(secondCredentials); });
  act(() => result.current.clearCredentials());
  await act(async () => { pending.resolve(); await rejected; });

  expect(result.current.status).toBe('anonymous');
  expect(result.current.credentials).toBeNull();
  expect(storage.has(AUTH_STORAGE_KEY)).toBe(false);
});

it('does not persist a login after the session unmounts', async () => {
  const storage = stubLocalStorage();
  const { pending, auth } = createPendingSession();
  const { result, unmount } = renderHook(() => useAuthSession(auth));
  const first = result.current.authenticate(firstCredentials);
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });

  unmount();
  pending.resolve();
  await rejected;

  expect(storage.has(AUTH_STORAGE_KEY)).toBe(false);
});

it('does not let a stale restoration failure remove a newer saved login', async () => {
  const storage = stubLocalStorage();
  storage.set(AUTH_STORAGE_KEY, JSON.stringify(firstCredentials));
  const { pending, auth } = createPendingSession();
  const { result } = renderHook(() => useAuthSession(auth));

  await act(async () => { await result.current.authenticate(secondCredentials); });
  await act(async () => { pending.reject(new Error('unauthorized')); });

  expect(result.current.credentials).toEqual(secondCredentials);
  expect(storage.get(AUTH_STORAGE_KEY)).toBe(JSON.stringify(secondCredentials));
});
