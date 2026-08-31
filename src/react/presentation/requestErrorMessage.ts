import { classifyRequestError } from '../domain/requestError';

type Translator = (key: string) => string;

export function getRequestErrorMessage(
  error: unknown,
  t: Translator,
  fallbackKey: string,
  authenticationKey = 'auth.sessionExpired',
): string {
  return t(classifyRequestError(error) === 'authentication' ? authenticationKey : fallbackKey);
}
