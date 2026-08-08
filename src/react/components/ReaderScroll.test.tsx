// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FeedItem } from '../types';
import { ReaderScroll } from './ReaderScroll';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./FeedItemCard', () => ({
  FeedItemCard: ({ item }: { item: FeedItem }) => <div data-testid="feed-item">{item.title}</div>,
}));

afterEach(() => {
  cleanup();
});

const items = Array.from({ length: 1_000 }, (_, index): FeedItem => ({
  id: index,
  feedId: 1,
  link: `https://example.com/${index}`,
  title: `Item ${index}`,
  text: '',
}));

describe('ReaderScroll', () => {
  it('keeps a bounded card window while paging forward and backward', () => {
    render(<ReaderScroll items={items} />);

    expect(screen.getAllByTestId('feed-item')).toHaveLength(20);
    const next = screen.getByRole('button', { name: 'reader.nextItems' });
    for (let page = 0; page < 12; page += 1) {
      fireEvent.click(next);
      expect(screen.getAllByTestId('feed-item')).toHaveLength(20);
    }
    expect(screen.getByText('Item 240')).toBeTruthy();
    expect(screen.queryByText('Item 0')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'reader.previousItems' }));
    expect(screen.getAllByTestId('feed-item')).toHaveLength(20);
    expect(screen.getByText('Item 220')).toBeTruthy();
  });
});
