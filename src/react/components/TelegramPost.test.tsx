// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { TelegramPost, isTelegramPost } from './TelegramPost';
import { inferFeedSourceFromLazyUrl } from '../domain/feedCreator';

afterEach(cleanup);
it('creates a public channel source without mistaking posts or lookalike hosts for channels', () => {
  expect(inferFeedSourceFromLazyUrl('https://t.me/mudotalida')).toEqual({ type: 'telegram', url: 'https://t.me/mudotalida' });
  expect(inferFeedSourceFromLazyUrl('https://t.me/mudotalida/9136')).toBeNull();
  expect(inferFeedSourceFromLazyUrl('https://t.me.evil.test/mudotalida')).toBeNull();
  expect(isTelegramPost('https://t.me/mudotalida/9136')).toBe(true);
  expect(isTelegramPost('https://t.me.evil.test/mudotalida/9136')).toBe(false);
});
it('renders formatted text, links and all photos while rejecting unsafe markup', () => {
  const { container } = render(<TelegramPost item={{ id: 1, feedId: 2, title: 'Post', link: 'https://t.me/mudotalida/9136', text: '<b>Hello</b> <a href="https://example.org/">link</a><img src="https://example.org/1.jpg" onerror="alert(1)"><img src="https://example.org/2.jpg"><a href="https://t.me/mudotalida/9136">Video</a><a href="javascript:alert(1)">bad</a><script>alert(1)</script>' }} />);
  expect(container.querySelector('b')?.textContent).toBe('Hello');
  expect(screen.getByRole('link', { name: 'link' }).getAttribute('href')).toBe('https://example.org/');
  expect(screen.getByRole('link', { name: 'Video' }).getAttribute('href')).toBe('https://t.me/mudotalida/9136');
  expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.org/1.jpg');
  fireEvent.click(screen.getByRole('button', { name: /next slide/i }));
  expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.org/2.jpg');
  expect(screen.getByText('2 / 2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /previous slide/i }));
  expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.org/1.jpg');
  expect(container.querySelector('[onerror], script, a[href^="javascript:"]')).toBeNull();
});
it('shows a post link when text and media are absent', () => {
  render(<TelegramPost item={{ id: 1, feedId: 2, title: '', link: 'https://t.me/mudotalida/9136', text: '' }} />);
  expect(screen.getByRole('link', { name: /Telegram/ }).getAttribute('href')).toBe('https://t.me/mudotalida/9136');
});
