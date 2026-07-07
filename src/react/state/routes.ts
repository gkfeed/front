import { getObjectProperty } from '../unknownObject';

export function getRedirectTarget(state: unknown): string {
  const from = getRouteLocation(state);
  if (!from || from.pathname === '/login') return '/';

  return `${from.pathname}${from.search}${from.hash}`;
}

export function getRouteLocation(state: unknown): { pathname: string; search: string; hash: string } | null {
  const from = getObjectProperty(state, 'from');

  const pathname = getObjectProperty(from, 'pathname');
  if (typeof pathname !== 'string') return null;

  const search = getObjectProperty(from, 'search');
  const hash = getObjectProperty(from, 'hash');

  return {
    pathname,
    search: typeof search === 'string' ? search : '',
    hash: typeof hash === 'string' ? hash : '',
  };
}
