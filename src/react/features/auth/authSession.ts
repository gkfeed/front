import { createAuthUseCases } from './authUseCaseFactory';
import { isAuthenticationError, validateCredentials } from './authentication';

export { createAuthUseCases } from './authUseCaseFactory';

// Kept as a compatibility façade for feature-level tests and callers. Runtime
// wiring uses the composition root, which supplies the same port explicitly.
const defaultAuthUseCases = createAuthUseCases({ validateCredentials, isAuthenticationError });

export const {
  authenticateCredentials,
  restoreAuthentication,
} = defaultAuthUseCases;
