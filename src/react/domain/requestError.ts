export type RequestErrorKind = 'authentication' | 'not-found' | 'other';

export function classifyRequestError(error: unknown): RequestErrorKind {
  const status = getErrorStatus(error);
  if (status === 401 || status === 403) return 'authentication';
  if (status === 404) return 'not-found';
  return 'other';
}

export function isAuthenticationError(error: unknown): boolean {
  return classifyRequestError(error) === 'authentication';
}

export function isNotFoundError(error: unknown): boolean {
  return classifyRequestError(error) === 'not-found';
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isInteger(status) ? status : null;
}
