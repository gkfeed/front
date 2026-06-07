import type { Credentials } from '../types';

export function getStoredCredentials(): Credentials | null {
  return null;
}

export function getAuthorizationHeader(credentials: Credentials | null): string | null {
  return credentials ? `Basic ${btoa(`${credentials.username}:${credentials.password}`)}` : null;
}

export function saveStoredCredentials(credentials: Credentials): void {
  void credentials;
}

export function clearStoredCredentials(): void {
}
