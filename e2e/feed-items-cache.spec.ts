import { expect, test } from '@playwright/test';

test('migrates the old cache and persists deletions without rewriting its snapshot', async ({ page }) => {
  await page.goto('/__fixtures/assets/portrait.svg');
  const result = await page.evaluate(async () => {
    const requestValue = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const original = indexedDB.open('gkfeed-cache', 1);
    original.onupgradeneeded = () => original.result.createObjectStore('feed-items', { keyPath: 'username' });
    const db = await requestValue(original);
    const items = Array.from({ length: 4 }, (_, index) => ({
      id: index + 1, feedId: 1, link: `https://example.com/${index}`,
      title: 'Item', text: `<img src="data:image/jpeg;base64,${'A'.repeat(1024 * 1024)}">`,
    }));
    const transaction = db.transaction('feed-items', 'readwrite');
    transaction.objectStore('feed-items').put({ username: 'fixture', savedAt: Date.now(), items, cursor: 'old' });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();

    const modulePath = '/src/react/services/feedItemsCache.ts';
    const cache = await import(/* @vite-ignore */ modulePath);
    const before = await cache.readFeedItemsCache('fixture');
    await cache.removeCachedFeedItem('fixture', 2);
    await cache.updateCachedFeedCursor('fixture', 'new');
    await cache.removeCachedFeedItem('fixture', 4);
    await cache.removeCachedFeedItem('fixture', 2);
    await cache.applyCachedFeedChanges('fixture', [{ ...items[1], title: 'Updated' }], [1, 4], 'remote');
    const after = await cache.readFeedItemsCache('fixture');
    const upgraded = await requestValue(indexedDB.open('gkfeed-cache', 3));
    const tx = upgraded.transaction(['feed-items', 'feed-item-deletions'], 'readonly');
    const snapshot = await requestValue(tx.objectStore('feed-items').get('fixture'));
    const deletions = await requestValue(tx.objectStore('feed-item-deletions').get('fixture'));
    upgraded.close();
    await cache.writeFeedItemsCache('fixture', { items: after.items, cursor: 'final' });
    const persisted = await cache.readFeedItemsCache('fixture');
    await cache.applyCachedFeedChanges('fixture', [{ ...items[3], title: 'Again' }], [2], 'later');
    const changed = await cache.readFeedItemsCache('fixture');
    await cache.removeCachedFeedItem('fixture', 4);
    const removedUpsert = await cache.readFeedItemsCache('fixture');
    return {
      before: before.items.map((item: { id: number }) => item.id),
      after: after.items.map((item: { id: number }) => item.id),
      rawSnapshot: snapshot.items.map((item: { id: number }) => item.id),
      deletions: deletions.ids,
      cursor: after.cursor,
      persisted: persisted.items.map((item: { id: number }) => item.id),
      persistedCursor: persisted.cursor,
      updatedTitle: after.items.find((item: { id: number }) => item.id === 2).title,
      changed: changed.items.map((item: { id: number }) => item.id),
      changedCursor: changed.cursor,
      removedUpsert: removedUpsert.items.map((item: { id: number }) => item.id),
    };
  });

  expect(result).toEqual({
    before: [1, 2, 3, 4], after: [3, 2], rawSnapshot: [1, 2, 3, 4],
    deletions: [4, 1], cursor: 'remote', persisted: [3, 2], persistedCursor: 'final',
    updatedTitle: 'Updated', changed: [4, 3], changedCursor: 'later', removedUpsert: [3],
  });
});

test('preserves the previous cache cursor and deletions when upgrading to per-item changes', async ({ page }) => {
  await page.goto('/__fixtures/assets/portrait.svg');
  const result = await page.evaluate(async () => {
    const requestValue = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const original = indexedDB.open('gkfeed-cache', 2);
    original.onupgradeneeded = () => {
      original.result.createObjectStore('feed-items', { keyPath: 'username' });
      original.result.createObjectStore('feed-item-deletions', { keyPath: 'username' });
    };
    const db = await requestValue(original);
    const item = (id: number) => ({ id, feedId: 1, link: `https://example.com/${id}`, title: 'Item', text: '' });
    const tx = db.transaction(['feed-items', 'feed-item-deletions'], 'readwrite');
    tx.objectStore('feed-items').put({ username: 'fixture', savedAt: Date.now(), items: [item(2), item(1)], cursor: 'old' });
    tx.objectStore('feed-item-deletions').put({ username: 'fixture', ids: [1], cursor: 'saved' });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    const modulePath = '/src/react/services/feedItemsCache.ts';
    const cache = await import(/* @vite-ignore */ modulePath);
    const before = await cache.readFeedItemsCache('fixture');
    await cache.applyCachedFeedChanges('fixture', [{ ...item(1), title: 'Restored' }], [2], 'next');
    const after = await cache.readFeedItemsCache('fixture');
    await cache.deleteFeedItemsCache('fixture');
    const cleared = await cache.readFeedItemsCache('fixture');
    return { before: before.items.map((entry: { id: number }) => entry.id), cursor: before.cursor,
      after: after.items.map((entry: { id: number; title: string }) => [entry.id, entry.title]),
      nextCursor: after.cursor, cleared: cleared === undefined };
  });
  expect(result).toEqual({ before: [2], cursor: 'saved', after: [[1, 'Restored']], nextCursor: 'next', cleared: true });
});
