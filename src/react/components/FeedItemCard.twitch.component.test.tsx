// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';
import { TwitchPreview } from './previews/TwitchPreview';
import { applyTheme } from '../theme';

describe('FeedItemCard Twitch player', () => {
  it('shows the channel separately from the stream title and highlights mentions and commands', () => {
    render(<FeedItemCard item={{
      ...item,
      title: 'leva2k: Пик Ленина @rostislav_999 !tg !donate',
      link: 'https://www.twitch.tv/leva2k',
    }} />);

    expect(screen.getByRole('heading', {
      name: 'Пик Ленина @rostislav_999 !tg !donate',
    })).toBeTruthy();
    expect(screen.getByText('leva2k').className).toContain('reader-card__channel');
    expect(screen.queryByText('leva2k:')).toBeNull();
    expect(screen.getByText('@rostislav_999').className)
      .toContain('reader-card__title-token--mention');
    expect(screen.getByText('!tg').className)
      .toContain('reader-card__title-token--command');
  });

  it('opens a Twitch embed in theater mode when the item is clicked', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.twitch.tv/some_channel',
    }} />);

    expect(screen.getByRole('article').classList.contains('reader-card--twitch')).toBe(true);
    expect(screen.getByRole('article').classList.contains('reader-card--player')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Story' }).parentElement?.classList
      .contains('reader-card__copy--player')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Story' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play some_channel on Twitch' })
      .closest('.reader-card__preview-trigger-wrap')?.contains(screen.getByRole('heading', { name: 'Story' })))
      .toBe(false);
    expect(screen.queryByText('twitch.tv')).toBeNull();
    expect(screen.queryByText(/Feed item #2/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Open original/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Play some_channel on Twitch' }));

    const player = screen.getByTitle('some_channel Twitch player');
    expect(player.tagName).toBe('IFRAME');
    expect(player.getAttribute('src'))
      .toBe('https://player.twitch.tv/?channel=some_channel&parent=localhost&autoplay=true');
    expect(player.getAttribute('allow')).toContain('autoplay');
    expect(screen.queryByTitle('some_channel Twitch chat')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show Twitch chat' }));
    const chat = screen.getByTitle('some_channel Twitch chat');
    expect(chat.tagName).toBe('IFRAME');
    expect(chat.getAttribute('src'))
      .toBe('https://www.twitch.tv/embed/some_channel/chat?parent=localhost');
    expect(screen.getByRole('button', { name: 'Hide Twitch chat' }).getAttribute('aria-pressed'))
      .toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Hide Twitch chat' }));
    expect(screen.queryByTitle('some_channel Twitch chat')).toBeNull();
    expect(screen.getByRole('button', { name: 'Exit theater mode' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(true);
    expect(getPreview).not.toHaveBeenCalled();
  });

  it('closes the Twitch theater mode with Escape without losing the player', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://twitch.tv/some_channel',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play some_channel on Twitch' }));
    const player = screen.getByTitle('some_channel Twitch player');
    fireEvent.click(screen.getByRole('button', { name: 'Show Twitch chat' }));

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByTitle('some_channel Twitch player')).toBe(player);
    expect(screen.getByTitle('some_channel Twitch chat')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enter theater mode' })).toBeTruthy();
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(false);
  });

  it('keeps an open theater visible when the stream ends', () => {
    const view = render(
      <TwitchPreview channel="some_channel" preview={null} onPreviewError={() => {}} isLive />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Play some_channel on Twitch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Twitch chat' }));

    view.rerender(
      <TwitchPreview channel="some_channel" preview={null} onPreviewError={() => {}} isLive={false} />,
    );

    expect(screen.getByRole('dialog', { name: 'some_channel Twitch player' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Stream ended');
    expect(screen.queryByTitle('some_channel Twitch player')).toBeNull();
    expect(screen.queryByTitle('some_channel Twitch chat')).toBeNull();
  });

  it('updates the Twitch chat theme when the app theme changes', async () => {
    applyTheme('dark');
    render(<TwitchPreview channel="some_channel" preview={null} onPreviewError={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play some_channel on Twitch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Twitch chat' }));

    expect(screen.getByTitle('some_channel Twitch chat').getAttribute('src'))
      .toBe('https://www.twitch.tv/embed/some_channel/chat?parent=localhost&darkpopout=true');

    act(() => applyTheme('light'));

    await waitFor(() => expect(screen.getByTitle('some_channel Twitch chat').getAttribute('src'))
      .toBe('https://www.twitch.tv/embed/some_channel/chat?parent=localhost'));
  });
});
