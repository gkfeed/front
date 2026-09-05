// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LiveEvent, LiveProviderAdapter } from '../components/live/liveProviderRegistry';
import { LivePage } from './LivePage';

const { useLivePageModel } = vi.hoisted(() => ({ useLivePageModel: vi.fn() }));
vi.mock('../adapters/live/useLivePageModel', () => ({ useLivePageModel }));

const streamAdapter: LiveProviderAdapter = {
  id: 'test-stream',
  category: { id: 'streams', titleKey: 'live.streams', order: 10, layout: 'grid' },
  strategy: 'round-robin',
  refreshIntervalMs: 60_000,
  dormantSweepCycles: 5,
  preserveEndedPlayback: false,
  recognize: () => null,
  check: async () => ({ updates: [], failures: 0 }),
  render: ({ event }) => <article>{event.candidate.item.title}</article>,
};

const esportsAdapter: LiveProviderAdapter = {
  ...streamAdapter,
  id: 'test-esports',
  category: { id: 'esports', titleKey: 'live.esports', order: 20, layout: 'list' },
};

function event(index: number, providerId = 'test-stream'): LiveEvent {
  return {
    candidate: {
      key: `${providerId}:${index}`,
      providerId,
      eventId: String(index),
      deduplicationKey: `${providerId}:${index}`,
      feedOrder: index,
      item: { id: index, feedId: 1, link: `https://example.com/${index}`, title: `Event ${index}`, text: '' },
    },
    data: { kind: 'twitch', channel: `channel${index}`, title: `Event ${index}` },
    checkedAt: Date.now(),
  };
}

function model(overrides: Record<string, unknown> = {}) {
  return {
    candidates: [],
    sections: [],
    adapters: [streamAdapter, esportsAdapter],
    scannedItems: 1200,
    scanComplete: true,
    scanError: '',
    lastSuccessfulAt: Date.now(),
    refreshing: false,
    refresh: vi.fn(),
    onPlaybackChange: vi.fn(),
    hasFreshEvents: false,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LivePage', () => {
  it('keeps the page name accessible and shows the search state during the first scan', () => {
    useLivePageModel.mockReturnValue(model({
      scanComplete: false,
      scannedItems: 300,
      sections: [
        { category: streamAdapter.category, events: [], providerIds: ['test-stream'], state: 'loading' },
        { category: esportsAdapter.category, events: [], providerIds: ['test-esports'], state: 'loading' },
      ],
    }));

    render(<LivePage />);

    expect(screen.getByRole('region', { name: 'Live' })).toBeTruthy();
    expect(screen.getAllByText('Searching your feed history for live events…')).toHaveLength(2);
    expect(screen.getByText('Indexing feed history: 300 items')).toBeTruthy();
  });

  it('orders semantic categories and hides healthy empty categories', () => {
    useLivePageModel.mockReturnValue(model({
      hasFreshEvents: true,
      sections: [
        { category: streamAdapter.category, events: [event(1)], providerIds: ['test-stream'], state: 'healthy' },
        { category: esportsAdapter.category, events: [event(2, 'test-esports')], providerIds: ['test-esports'], state: 'healthy' },
        { category: { id: 'football', titleKey: 'Football', order: 30, layout: 'list' }, events: [], providerIds: [], state: 'healthy' },
      ],
    }));

    render(<LivePage />);

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Streams', 'Esports']);
    expect(screen.queryByText('Football')).toBeNull();
    expect(screen.getByText('Event 1')).toBeTruthy();
    expect(screen.getByText('Event 2')).toBeTruthy();
  });

  it('shows six events until the category is expanded', () => {
    const events = Array.from({ length: 8 }, (_, index) => event(index + 1));
    useLivePageModel.mockReturnValue(model({
      hasFreshEvents: true,
      sections: [{ category: streamAdapter.category, events, providerIds: ['test-stream'], state: 'healthy' }],
    }));

    render(<LivePage />);

    expect(screen.getByText('Event 6')).toBeTruthy();
    expect(screen.queryByText('Event 7')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show all 8' }));
    expect(screen.getByText('Event 7')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show fewer' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('shows local provider failure and runs one manual refresh action', () => {
    const refresh = vi.fn();
    useLivePageModel.mockReturnValue(model({
      refresh,
      sections: [{ category: esportsAdapter.category, events: [], providerIds: ['test-esports'], state: 'error' }],
    }));

    render(<LivePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByRole('alert').textContent).toContain('This section could not be updated.');
    expect(refresh).toHaveBeenCalledOnce();
  });
});
