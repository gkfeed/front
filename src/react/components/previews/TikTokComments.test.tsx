// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FeedItem } from '../../types';
import { fetchTikTokComments } from '../../services/tiktokComments';
import { TikTokComments } from './TikTokComments';

vi.mock('../../services/tiktokComments');

const item: FeedItem = {
  id: 12,
  feedId: 2,
  link: 'https://www.tiktok.com/@creator/video/123',
  title: 'Creator video',
  text: 'Video caption',
};

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.resetAllMocks();
});

describe('TikTokComments', () => {
  it('shows and hides the video description with the comments', async () => {
    vi.mocked(fetchTikTokComments).mockResolvedValue({
      comments: [],
      description: null,
      creatorName: null,
      creatorAvatarUrl: null,
    });
    render(<TikTokComments item={{ ...item, text: '<p>Video <strong>caption</strong> #topic</p>' }} />);

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
    render(<TikTokComments item={{ ...item, text: '' }} />);

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
      .mockResolvedValueOnce({
        comments: [],
        description: null,
        creatorName: null,
        creatorAvatarUrl: null,
      });
    render(<TikTokComments item={item} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(fetchTikTokComments).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No comments are available for this video.')).toBeTruthy();
  });

  it('remembers comment visibility across TikTok videos for the session', async () => {
    vi.mocked(fetchTikTokComments).mockResolvedValue({
      comments: [],
      description: null,
      creatorName: null,
      creatorAvatarUrl: null,
    });
    const first = render(<TikTokComments item={item} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }));
    expect(await screen.findByRole('button', { name: 'Hide comments' })).toBeTruthy();
    first.unmount();

    render(<TikTokComments item={{ ...item, id: 13, link: 'https://www.tiktok.com/@creator/video/456' }} />);
    expect(screen.getByRole('button', { name: 'Hide comments' })).toBeTruthy();
    await waitFor(() => expect(fetchTikTokComments).toHaveBeenLastCalledWith(
      'https://www.tiktok.com/@creator/video/456',
      expect.any(AbortSignal),
    ));
  });
});
