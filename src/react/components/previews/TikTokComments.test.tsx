// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FeedItem } from '../../types';
import { fetchTikTokComments } from '../../services/tiktokComments';
import type { TikTokCommentsPreview } from '../../../../shared/tiktokContracts';
import { TikTokComments } from './TikTokComments';

vi.mock('../../services/tiktokComments');

const item: FeedItem = {
  id: 12,
  feedId: 2,
  link: 'https://www.tiktok.com/@creator/video/123',
  title: 'Creator video',
  text: 'Video caption',
};

const emptyComments: TikTokCommentsPreview = {
  comments: [],
  description: null,
  creatorName: null,
  creatorAvatarUrl: null,
};

function renderComments(overrides: Partial<FeedItem> = {}) {
  return render(<TikTokComments item={{ ...item, ...overrides }} />);
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('TikTokComments', () => {
  it('traps focus only in the mobile Review dialog and restores it on Escape', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body);
    vi.mocked(fetchTikTokComments).mockResolvedValue(emptyComments);
    render(<div className="reader__item--tiktok"><TikTokComments item={item} /></div>);
    const show = screen.getByRole('button', { name: 'Show comments' });
    show.focus();
    fireEvent.click(show);

    const dialog = await screen.findByRole('dialog');
    expect(document.activeElement).toBe(dialog);
    const copy = screen.getByRole('button', { name: 'Copy link' });
    copy.focus();
    expect(fireEvent.keyDown(copy, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(dialog.querySelector('a'));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(show);
  });

  it('releases the mobile dialog when the viewport becomes desktop', async () => {
    let onChange!: () => void;
    const mediaQuery = {
      matches: true,
      addEventListener: vi.fn((_event: string, listener: () => void) => { onChange = listener; }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => mediaQuery);
    vi.mocked(fetchTikTokComments).mockResolvedValue(emptyComments);
    const view = render(<div className="reader__item--tiktok"><TikTokComments item={item} /></div>);
    const show = screen.getByRole('button', { name: 'Show comments' });
    show.focus();
    fireEvent.click(show);
    await screen.findByRole('dialog');

    act(() => { mediaQuery.matches = false; onChange(); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(show);
    expect(screen.getByRole('button', { name: 'Hide comments' })).toBeTruthy();
    view.unmount();
    expect(mediaQuery.removeEventListener).toHaveBeenCalledWith('change', onChange);
  });

  it('preserves focus and normal Tab navigation when expanding multiple inline panels', async () => {
    vi.mocked(fetchTikTokComments).mockResolvedValue(emptyComments);
    render(<>
      <TikTokComments item={item} />
      <TikTokComments item={{ ...item, id: 13, link: 'https://www.tiktok.com/@creator/video/456' }} />
      <button type="button">Outside comments</button>
    </>);
    const show = screen.getAllByRole('button', { name: 'Show comments' })[0]!;
    show.focus();
    fireEvent.click(show);

    await screen.findAllByRole('button', { name: 'Hide comments' });
    expect(document.activeElement).toBe(show);
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
    const outside = screen.getByRole('button', { name: 'Outside comments' });
    outside.focus();
    expect(fireEvent.keyDown(outside, { key: 'Tab' })).toBe(true);
    expect(document.activeElement).toBe(outside);
  });

  it('copies the TikTok link and confirms success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...window.navigator,
      clipboard: { writeText },
      language: window.navigator.language,
    });
    renderComments();

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(item.link));
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it('loads comments only after the expanded card becomes visible', async () => {
    window.sessionStorage.setItem('gkfeed:tiktok-comments-expanded', 'true');
    const callbacks: IntersectionObserverCallback[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }

      observe() {}

      disconnect() {}
    });
    vi.mocked(fetchTikTokComments).mockResolvedValue(emptyComments);

    render(
      <>
        <TikTokComments item={item} />
        <TikTokComments item={{ ...item, id: 13, link: 'https://www.tiktok.com/@creator/video/456' }} />
      </>,
    );

    expect(callbacks).toHaveLength(2);
    expect(fetchTikTokComments).not.toHaveBeenCalled();

    act(() => callbacks[0]?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ));

    await waitFor(() => expect(fetchTikTokComments).toHaveBeenCalledTimes(1));
    expect(fetchTikTokComments).toHaveBeenCalledWith(item.link, expect.any(AbortSignal));
  });

  it('finishes loading when comments are expanded on mount in StrictMode', async () => {
    window.sessionStorage.setItem('gkfeed:tiktok-comments-expanded', 'true');
    vi.mocked(fetchTikTokComments).mockResolvedValue(emptyComments);

    render(
      <StrictMode>
        <TikTokComments item={item} />
      </StrictMode>,
    );

    expect(await screen.findByText('No comments are available for this video.')).toBeTruthy();
  });

  it('announces loading and aborts an in-flight request when collapsed', async () => {
  vi.mocked(fetchTikTokComments).mockImplementation((_url, signal) => new Promise((resolve) => {
      signal.addEventListener('abort', () => resolve(emptyComments));
    }));
    renderComments();

    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }));

    expect(await screen.findByText('Loading comments…')).toBeTruthy();
    const signal = vi.mocked(fetchTikTokComments).mock.calls[0]?.[1];
    expect(signal?.aborted).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Hide comments' }));

    expect(signal?.aborted).toBe(true);
  });

  it('shows and hides the video description with the comments', async () => {
    vi.mocked(fetchTikTokComments).mockResolvedValue(emptyComments);
    renderComments({ text: '<p>Video <strong>caption</strong> #topic</p>' });

    expect(screen.queryByText('Video caption #topic')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }));
    await screen.findByText('#topic');

    const description = document.querySelector('.tiktok-comments__description');
    const commentsHeading = screen.getByRole('heading', { name: 'Comments' });
    expect(description?.textContent).toBe('Video caption #topic');
    expect(screen.getByText('#topic').tagName).toBe('STRONG');
    expect(description?.querySelector('p')?.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(
      commentsHeading.compareDocumentPosition(description!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide comments' }));
    expect(screen.queryByText('Video caption #topic')).toBeNull();
  });

  it('does not render replacement markers from a feed item', async () => {
    vi.mocked(fetchTikTokComments).mockResolvedValue(emptyComments);
    renderComments({ title: '\uFFFD', text: '<p>\uFFFD</p>' });

    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }));

    expect(await screen.findByText('No comments are available for this video.')).toBeTruthy();
    expect(document.querySelector('.tiktok-comments')?.textContent).not.toContain('\uFFFD');
  });

  it('fetches multiple real comments only after expansion', async () => {
    vi.mocked(fetchTikTokComments).mockResolvedValue({
      comments: [
        { id: '1', text: 'First', author: 'Mira', username: 'mira', avatarUrl: 'https://example.com/mira.jpg' },
        { id: '2', text: 'Second', author: 'Leo', username: 'leo', avatarUrl: null },
        { id: '3', text: 'Third', author: 'Ana', username: 'ana', avatarUrl: null },
      ],
      description: 'Remote caption #topic',
      creatorName: 'Video Creator',
      creatorAvatarUrl: 'https://example.com/creator.jpg',
    });
    renderComments({ text: '' });

    expect(fetchTikTokComments).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }));

    const listItems = await screen.findAllByRole('listitem');
    expect(listItems).toHaveLength(4);
    expect(listItems[0]?.classList.contains('tiktok-comments__description')).toBe(true);
    expect(screen.getByText('Mira')).toBeTruthy();
    expect(screen.getByText('@mira')).toBeTruthy();
    expect(document.querySelector('.tiktok-comments__avatar img')?.getAttribute('src'))
      .toBe('https://example.com/mira.jpg');
    expect(screen.getByText('Remote caption', { exact: false })).toBeTruthy();
    expect(screen.getByText('#topic').tagName).toBe('STRONG');
    expect(screen.getByText('Video Creator')).toBeTruthy();
    expect(document.querySelector('.tiktok-comments__creator-avatar img')?.getAttribute('src'))
      .toBe('https://example.com/creator.jpg');
    expect(fetchTikTokComments).toHaveBeenCalledWith(item.link, expect.any(AbortSignal));
  });

  it('offers retry when loading fails', async () => {
    vi.mocked(fetchTikTokComments)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(emptyComments);
    renderComments();

    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(fetchTikTokComments).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No comments are available for this video.')).toBeTruthy();
  });

  it('ignores a stale response after the video link changes', async () => {
    let resolveFirst: ((result: TikTokCommentsPreview) => void) | undefined;
    let resolveSecond: ((result: TikTokCommentsPreview) => void) | undefined;
    vi.mocked(fetchTikTokComments)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const view = renderComments();

    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }));
    await waitFor(() => expect(fetchTikTokComments).toHaveBeenCalledTimes(1));

    view.rerender(<TikTokComments item={{ ...item, link: 'https://www.tiktok.com/@creator/video/456' }} />);
    await waitFor(() => expect(fetchTikTokComments).toHaveBeenCalledTimes(2));

    resolveFirst?.({
      comments: [{ id: 'old', text: 'Old response', author: 'Old', username: 'old', avatarUrl: null }],
      description: null,
      creatorName: null,
      creatorAvatarUrl: null,
    });
    resolveSecond?.({
      comments: [{ id: 'new', text: 'New response', author: 'New', username: 'new', avatarUrl: null }],
      description: null,
      creatorName: null,
      creatorAvatarUrl: null,
    });

    expect(await screen.findByText('New response')).toBeTruthy();
    expect(screen.queryByText('Old response')).toBeNull();
  });

  it('remembers comment visibility across TikTok videos for the session', async () => {
    vi.mocked(fetchTikTokComments).mockResolvedValue(emptyComments);
    const first = renderComments();

    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }));
    expect(await screen.findByRole('button', { name: 'Hide comments' })).toBeTruthy();
    first.unmount();

    renderComments({ id: 13, link: 'https://www.tiktok.com/@creator/video/456' });
    expect(screen.getByRole('button', { name: 'Hide comments' })).toBeTruthy();
    await waitFor(() => expect(fetchTikTokComments).toHaveBeenLastCalledWith(
      'https://www.tiktok.com/@creator/video/456',
      expect.any(AbortSignal),
    ));
  });
});
