import { isOpenGraphPreview } from '../../shared/previewGuards';
import { isRecord } from '../../shared/valueGuards';
import { parseFeeds, parseItemsSyncPage } from '../react/services/feedSchemas';
import { deleteFeedItemsCache } from '../react/services/feedItemsCache';
import { AUTH_STORAGE_KEY } from '../react/state/authStorage';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

export async function installReaderFixture(): Promise<string> {
  const name = location.pathname.startsWith('/__verify/')
    ? location.pathname.split('/')[2] ?? ''
    : new URLSearchParams(location.search).get('fixture') ?? '';
  if (!/^[a-zA-Z0-9_-]+(?:\.local)?$/.test(name)) {
    throw new Error('Use ?fixture=<name> matching a JSON file in dev/reader-fixtures.');
  }
  const nativeFetch = window.fetch.bind(window);
  const response = await nativeFetch(`/__fixtures/${name}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Reader fixture "${name}" was not found.`);
  // Absolute same-origin media URLs pass through the real production parsers.
  const raw: unknown = JSON.parse((await response.text()).replaceAll('{{origin}}', location.origin));
  if (!isRecord(raw)) throw new Error('A fixture must be an API item or an object containing items.');
  let items = Array.isArray(raw.items) ? raw.items : [raw];
  const snapshot = parseItemsSyncPage({
    items, next_cursor: '', has_more: false, sync_cursor: 'fixture-sync',
  });
  if (snapshot.items.length !== items.length) throw new Error('Fixture items must have nonempty links.');
  if (new Set(snapshot.items.map((item) => item.id)).size !== items.length) {
    throw new Error('Fixture item IDs must be unique.');
  }
  let feeds = parseFeeds(raw.feeds ?? [...new Set(snapshot.items.map((item) => item.feedId))].map((id) => ({
    id, title: `Fixture feed ${id}`, type: 'rss', url: 'https://example.com/fixture-feed',
  })));
  const previews = raw.previews ?? {};
  const responses = raw.responses ?? {};
  if (!isRecord(previews) || !Object.values(previews).every(isOpenGraphPreview) || !isRecord(responses)) {
    throw new Error('Invalid fixture previews or responses.');
  }
  const username = `__verification__:${name}`;
  // Preferences and credentials are tab-local. Real browser storage is untouched.
  Object.defineProperty(window, 'localStorage', { configurable: true, value: memoryStorage({
    [AUTH_STORAGE_KEY]: JSON.stringify({ username, password: 'fixture' }),
  }) });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: memoryStorage() });
  await deleteFeedItemsCache(username);
  const diagnostics = { name, itemIds: snapshot.items.map((item) => item.id), requests: [] as string[], blockedRequests: [] as string[] };
  Object.defineProperty(window, '__readerFixture', { configurable: true, value: diagnostics });
  document.documentElement.dataset.readerFixture = name;
  const basename = `/__verify/${name}`;
  if (!location.pathname.startsWith('/__verify/')) {
    const search = new URLSearchParams(location.search);
    search.delete('fixture');
    const query = search.size ? `?${search}` : '';
    history.replaceState(null, '', `${basename}${location.pathname}${query}${location.hash}`);
  }

  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    request.signal.throwIfAborted();
    const url = new URL(request.url, location.href);
    if (url.origin === location.origin && url.pathname.startsWith('/__fixtures/')) {
      return nativeFetch(input, init);
    }
    const route = `${request.method} ${url.pathname}`;
    diagnostics.requests.push(route);
    const json = (value: unknown) => Response.json(value);
    if (request.method === 'GET') {
      if (url.pathname === '/api/v1/list') return json(feeds);
      if (url.pathname === '/api/v2/items/sync') {
        return json({ items, next_cursor: '', has_more: false, sync_cursor: 'fixture-sync' });
      }
      if (url.pathname === '/api/v2/items/changes') {
        return json({ upserted: [], deleted_ids: [], next_cursor: 'fixture-sync', has_more: false });
      }
      const configured = responses[`${url.pathname}${url.search}`] ?? responses[url.pathname];
      if (configured !== undefined) return json(configured);
      if (url.pathname === '/bff/open-graph') {
        const link = url.searchParams.get('url') ?? '';
        const item = snapshot.items.find((candidate) => candidate.link === link);
        return json(previews[link] ?? {
          url: link, title: item?.title ?? null, description: null, image: null,
          video: null, siteName: null, type: 'article', providerData: null,
        });
      }
    }
    if (request.method === 'DELETE' && /^\/api\/v1\/items\/\d+$/.test(url.pathname)) {
      const id = Number(url.pathname.split('/').at(-1));
      items = items.filter((item) => isRecord(item) && item.id !== id);
      return json({});
    }
    if (request.method === 'DELETE' && url.pathname === '/api/v1/delete') {
      feeds = feeds.filter((feed) => feed.id !== Number(url.searchParams.get('id')));
      return json({});
    }
    diagnostics.blockedRequests.push(route);
    console.error(`Fixture "${name}" has no response for ${route}. Add it to responses.`);
    return Response.json({ error: `Unmocked fixture request: ${route}` }, { status: 501 });
  };
  return basename;
}
