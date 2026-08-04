import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateCredentials } from '../../services/auth';
import { createAuthUseCases } from './authUseCaseFactory';

vi.mock('../../services/auth', () => ({
  validateCredentials: vi.fn(),
}));

const validate = vi.mocked(validateCredentials);
const credentials = { username: 'alice', password: 'secret' };
const useCases = () => createAuthUseCases({
  validateCredentials: (nextCredentials, signal) => signal === undefined
    ? validateCredentials(nextCredentials)
    : validateCredentials(nextCredentials, signal),
  isAuthenticationError: (error) => (
    typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 401
  ),
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('auth session use cases', () => {
  it('persists credentials only after validation succeeds', async () => {
    const persist = vi.fn();
    validate.mockResolvedValue();

    await useCases().authenticateCredentials(credentials, persist);

    expect(validate).toHaveBeenCalledWith(credentials);
    expect(persist).toHaveBeenCalledWith(credentials);
  });

  it('does not persist rejected credentials', async () => {
    const persist = vi.fn();
    const error = new Error('invalid credentials');
    validate.mockRejectedValue(error);

    await expect(useCases().authenticateCredentials(credentials, persist)).rejects.toBe(error);
    expect(persist).not.toHaveBeenCalled();
  });

  it('removes invalid persisted credentials during restore', async () => {
    const remove = vi.fn();
    validate.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }));

    await expect(useCases().restoreAuthentication(credentials, remove)).rejects.toMatchObject({ status: 401 });
    expect(remove).toHaveBeenCalledOnce();
  });
});
