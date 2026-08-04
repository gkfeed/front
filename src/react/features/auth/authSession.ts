import type { Credentials } from '../../types';
import { isAuthenticationError, validateCredentials } from './authentication';

export async function authenticateCredentials(
  credentials: Credentials,
  persist: (credentials: Credentials) => void,
  signal?: AbortSignal,
): Promise<void> {
  await validateCredentials(credentials, signal);
  persist(credentials);
}

export async function restoreAuthentication(
  credentials: Credentials,
  removePersistedCredentials: () => void,
  signal?: AbortSignal,
): Promise<Credentials> {
  try {
    await validateCredentials(credentials, signal);
    return credentials;
  } catch (error) {
    if (isAuthenticationError(error)) removePersistedCredentials();
    throw error;
  }
}
