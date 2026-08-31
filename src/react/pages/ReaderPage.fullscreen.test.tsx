// @vitest-environment jsdom

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteFeedItemById, getFeedItems } from '../services/feeds';
import { READER_ITEMS as ITEMS, renderReader, resetReaderPageTest } from './ReaderPage.test.utils';

vi.mock('../services/feeds');
vi.mock('../services/feedItemsCache');
vi.mock('../state/useAuth', () => {
  const auth = { credentials: { username: 'reader', password: 'secret' } };
  return { useAuth: () => auth };
});

afterEach(resetReaderPageTest);

describe('ReaderPage fullscreen', () => {
  it.each([
    ['TikTok', {
      id: 20,
      feedId: 4,
      link: 'https://www.tiktok.com/@creator/video/123',
      title: 'Short video',
      text: '',
    }],
    ['Instagram', {
      id: 21,
      feedId: 5,
      link: 'https://www.instagram.com/p/example/',
      title: 'inst: creator',
      text: '',
    }],
  ] as const)('automatically enters fullscreen for %s on mobile', async (_provider, item) => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    vi.mocked(getFeedItems).mockResolvedValue([item]);
    const main = document.createElement('main');
    document.body.append(main);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByRole('button', { name: 'Exit Reader fullscreen' })).toBeTruthy();
    expect(document.documentElement.dataset.readerFullscreen).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Exit Reader fullscreen' }));
    await waitFor(() => expect(document.documentElement.dataset.readerFullscreen).toBeUndefined());
  });

  it('updates automatic fullscreen when the viewport crosses the mobile breakpoint', async () => {
    let viewportWidth = 1024;
    vi.spyOn(window, 'innerWidth', 'get').mockImplementation(() => viewportWidth);
    vi.mocked(getFeedItems).mockResolvedValue([{
      id: 20,
      feedId: 4,
      link: 'https://www.tiktok.com/@creator/video/123',
      title: 'Short video',
      text: '',
    }]);
    const main = document.createElement('main');
    document.body.append(main);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByTitle('Video preview for Short video')).toBeTruthy();
    expect(document.documentElement.dataset.readerFullscreen).toBeUndefined();

    viewportWidth = 390;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(document.documentElement.dataset.readerFullscreen).toBe('true'));

    viewportWidth = 1024;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(document.documentElement.dataset.readerFullscreen).toBeUndefined());
  });

  it('toggles fullscreen with the f keyboard shortcut', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    const main = document.createElement('main');
    document.body.append(main);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'f' });
    await waitFor(() => {
      expect(document.documentElement.dataset.readerFullscreen).toBe('true');
      expect(screen.getByRole('button', { name: 'Exit Reader fullscreen' })).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: 'f' });
    await waitFor(() => {
      expect(document.documentElement.dataset.readerFullscreen).toBeUndefined();
      expect(screen.getByRole('button', { name: 'Open Reader fullscreen' })).toBeTruthy();
    });
  });

  it.each([
    ['keeping', /keep/i, undefined],
    ['deleting', /delete/i, () => vi.mocked(deleteFeedItemById).mockResolvedValue()],
  ] as const)('keeps fullscreen active when %s the current item', async (_action, buttonName, setup) => {
    setup?.();
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    const main = document.createElement('main');
    document.body.append(main);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'f' });
    await waitFor(() => expect(document.documentElement.dataset.readerFullscreen).toBe('true'));
    fireEvent.click(screen.getByRole('button', { name: buttonName }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(document.documentElement.dataset.readerFullscreen).toBe('true');
    expect(screen.getByRole('button', { name: 'Exit Reader fullscreen' })).toBeTruthy();
  });

  it('keeps review actions in the stable controls row after viewport changes', async () => {
    vi.mocked(getFeedItems).mockResolvedValue([ITEMS[0]]);
    renderReader();
    expect(await screen.findByRole('button', { name: /keep/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Feed item actions' })).toBeNull();

    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('button', { name: /keep/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
  });

  it('keeps the controls row unchanged when the fullscreen main scrolls', async () => {
    const main = document.createElement('main');
    document.body.append(main);
    vi.mocked(getFeedItems).mockResolvedValue([ITEMS[0]]);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByRole('button', { name: /keep/i })).toBeTruthy();
    fireEvent.scroll(main);
    expect(screen.getByRole('button', { name: /keep/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
  });
});
