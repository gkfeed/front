import type { AuthApplicationPort } from '../featurePorts';
import type { Credentials } from '../../types';

export interface AuthUseCases {
  authenticateCredentials: (
    credentials: Credentials,
    persist: (credentials: Credentials) => void,
    signal?: AbortSignal,
  ) => Promise<void>;
  restoreAuthentication: (
    credentials: Credentials,
    removePersistedCredentials: () => void,
    signal?: AbortSignal,
  ) => Promise<Credentials>;
}

export function createAuthUseCases(port: AuthApplicationPort): AuthUseCases {
  async function authenticateCredentials(
    credentials: Credentials,
    persist: (credentials: Credentials) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    await port.validateCredentials(credentials, signal);
    persist(credentials);
  }

  async function restoreAuthentication(
    credentials: Credentials,
    removePersistedCredentials: () => void,
    signal?: AbortSignal,
  ): Promise<Credentials> {
    try {
      await port.validateCredentials(credentials, signal);
      return credentials;
    } catch (error) {
      if (port.isAuthenticationError(error)) removePersistedCredentials();
      throw error;
    }
  }

  return { authenticateCredentials, restoreAuthentication };
}
