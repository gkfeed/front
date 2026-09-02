// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FeedItemProvider } from '../../domain/feedItemPreviewTypes';
import type { FeedItemCardModel } from '../useFeedItemCardModel';
import {
  FeedItemCardProviderContent,
  getFeedItemCardClassNames,
} from './feedItemCardProviderRegistry';

const providers: FeedItemProvider[] = [
  'generic',
  'hltv',
  'instagram',
  'liquipedia',
  'matreshka',
  'onefootball',
  'sasflix',
  'tiktok',
  'twitch',
  'vk',
  'youtube',
];

function createFacts(overrides: Partial<FeedItemCardModel> = {}): FeedItemCardModel {
  return {
    item: { id: 1, feedId: 2, link: 'https://example.com/story', title: 'Story', text: '' },
    hostname: 'example.com',
    provider: 'generic',
    variant: { type: 'standard' },
    imagePreview: { type: 'none' },
    openGraphPreview: null,
    liquipediaMatch: null,
    description: null,
    isNsfw: false,
    shouldBlurNsfw: false,
    shouldHideNsfw: false,
    canReadArticle: false,
    descriptor: {
      renderer: 'generic',
      preview: { type: 'media', isShortVideo: false, isTikTok: false },
      copy: 'standard',
      imagePresentation: 'standard',
      showInstagramIdentity: false,
      showHltvCountdown: false,
      showTikTokComments: false,
    },
    visiblePreview: null,
    preview: null,
    hltvMatchTeams: null,
    hltvSnapshot: null,
    hltvImageScore: null,
    oneFootballSnapshot: null,
    cardRef: { current: null },
    isPreviewPending: false,
    previewStatus: 'idle',
    onPreviewError: vi.fn(),
    ...overrides,
  };
}

function renderProvider(facts: FeedItemCardModel) {
  return render(
    <FeedItemCardProviderContent
      facts={facts}
      localizedPreview={null}
      displayHostname={facts.hostname ?? 'Feed item'}
      previewPlaceholder={<div data-testid="preview-placeholder" />}
    />,
  );
}

describe('feed item card provider rendering', () => {
  it('dispatches every provider through the public render path', () => {
    for (const provider of providers) {
      const facts = createFacts({
        descriptor: { ...createFacts().descriptor, renderer: provider },
      });
      const view = renderProvider(facts);

      expect(getFeedItemCardClassNames(facts)).toBeInstanceOf(Array);
      view.unmount();
    }
  });

  it('dispatches only through the completed presentation descriptor', () => {
    const facts = createFacts({
      descriptor: { ...createFacts().descriptor, renderer: 'tiktok' },
    });

    expect(getFeedItemCardClassNames(facts)).toContain('reader-card--tiktok');
  });

  it('keeps unsupported slots internal and renders them as no-ops', () => {
    const { container } = renderProvider(createFacts({
      descriptor: { ...createFacts().descriptor, copy: 'none' },
    }));

    expect(container.querySelector('.reader-card__copy')).toBeNull();
  });

  it('centralizes copy visibility for all providers', () => {
    const { container, rerender } = renderProvider(createFacts());
    expect(container.querySelector('.reader-card__copy')).toBeTruthy();

    const hiddenCopyFacts = createFacts({
      descriptor: { ...createFacts().descriptor, copy: 'none' },
    });
    rerender(
      <FeedItemCardProviderContent
        facts={hiddenCopyFacts}
        localizedPreview={null}
        displayHostname="example.com"
        previewPlaceholder={null}
      />,
    );

    expect(container.querySelector('.reader-card__copy')).toBeNull();
  });

  it('renders Instagram identity inside the provider preview', () => {
    const facts = createFacts({
      item: {
        id: 1,
        feedId: 2,
        link: 'https://www.instagram.com/p/example',
        title: 'inst: creator',
        text: '',
      },
      descriptor: {
        ...createFacts().descriptor,
        renderer: 'instagram',
        preview: { type: 'media', isShortVideo: true, isTikTok: false },
        showInstagramIdentity: true,
      },
    });
    const { container } = render(
      <FeedItemCardProviderContent
        facts={facts}
        localizedPreview={{ src: 'https://example.com/photo.jpg', alt: 'Photo' }}
        displayHostname=""
        previewPlaceholder={null}
      />,
    );

    const preview = container.querySelector('.reader-card__preview');
    expect(preview?.querySelector('.reader-card__short-video-identity')).toBeTruthy();
    expect(container.textContent).toContain('creator');
  });

  it('falls back to standard copy when a variant-specific renderer receives another variant', () => {
    const { container } = renderProvider(createFacts({
      descriptor: { ...createFacts().descriptor, renderer: 'youtube' },
    }));

    expect(container.querySelector('.reader-card__youtube-copy')).toBeNull();
    expect(container.querySelector('.reader-card__copy')).toBeTruthy();
    expect(container.querySelector('.reader-card__link')?.getAttribute('href'))
      .toBe('https://example.com/story');
  });

  it('owns pending slot composition inside the provider render path', () => {
    const { container, getByTestId } = renderProvider(createFacts({ isPreviewPending: true }));

    expect(getByTestId('preview-placeholder')).toBeTruthy();
    expect(container.querySelector('.reader-card__copy')).toBeNull();
  });
});
