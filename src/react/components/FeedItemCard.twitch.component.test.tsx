// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard Twitch player', () => {
  it('removes the channel prefix and highlights mentions and commands', () => {
    render(<FeedItemCard item={{
      ...item,
      title: 'leva2k: Пик Ленина @rostislav_999 !tg !donate',
      link: 'https://www.twitch.tv/leva2k',
    }} />);

    expect(screen.getByRole('heading', {
      name: 'Пик Ленина @rostislav_999 !tg !donate',
    })).toBeTruthy();
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

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByTitle('some_channel Twitch player')).toBe(player);
    expect(screen.getByRole('button', { name: 'Enter theater mode' })).toBeTruthy();
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(false);
  });
});
