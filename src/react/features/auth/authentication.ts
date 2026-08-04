import type { Credentials } from '../../types';
import { validateCredentials as validateCredentialsRequest } from '../../services/auth';

export function validateCredentials(credentials: Credentials, signal?: AbortSignal): Promise<void> {
  return signal === undefined
    ? validateCredentialsRequest(credentials)
    : validateCredentialsRequest(credentials, signal);
}

export { isAuthenticationError } from '../../services/authError';
