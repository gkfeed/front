import type { Credentials } from '../types';
import { getObjectProperty } from '../unknownObject';

export const AUTH_STORAGE_KEY = 'gkfeed.credentials';

export function readStoredCredentials(): Credentials | null {
  const storage = getCredentialStorage();
  if (!storage) return null;

  try {
    const stored = storage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredCredentials(credentials: Credentials): void {
  const storage = getCredentialStorage();
  if (!storage) return;

  try {
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // Keep the in-memory login usable if storage is unavailable.
  }
}

export function removeStoredCredentials(): void {
  const storage = getCredentialStorage();
  if (!storage) return;

  try {
    storage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Nothing to recover; the in-memory state has already been cleared.
  }
}

function isCredentials(value: unknown): value is Credentials {
  const username = getObjectProperty(value, 'username');
  const password = getObjectProperty(value, 'password');
  return typeof username === 'string' && typeof password === 'string';
}

function getCredentialStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
