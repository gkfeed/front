// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { FeedItemCardModel } from '../useFeedItemCardModel';
import {
  feedItemCardProviderRendererMap,
  getFeedItemCardProviderRenderer,
} from './feedItemCardProviderRegistry';

function createModel(overrides: Partial<FeedItemCardModel> = {}): FeedItemCardModel {
  return {
    item: {
      id: 1,
      feedId: 2,
      link: 'https://example.com/story',
      title: 'Story',
      text: '',
    },
    hostname: null,
    provider: 'generic',
    variant: { type: 'standard' },
    imagePreview: { type: 'none' },
    openGraphPreview: null,
    liquipediaMatch: null,
    description: null,
    isNsfw: false,
    shouldBlurNsfw: false,
    shouldHideNsfw: false,
    hltvMatchTeams: null,
    hltvSnapshot: null,
    hltvImageScore: null,
    descriptor: {
      preview: { type: 'media', isShortVideo: false, isTikTok: false },
      copy: 'standard',
      showInstagramIdentity: false,
      showHltvCountdown: false,
      showTikTokComments: false,
    },
    preview: null,
    visiblePreview: null,
    cardRef: { current: null },
    isPreviewPending: false,
    previewStatus: 'idle',
    onPreviewError: vi.fn(),
    ...overrides,
  } as FeedItemCardModel;
}

describe('feed item card provider renderer map', () => {
  it('registers every provider with all rendering slots', () => {
    for (const provider of Object.keys(feedItemCardProviderRendererMap) as Array<
      keyof typeof feedItemCardProviderRendererMap
    >) {
      const renderer = getFeedItemCardProviderRenderer(provider);

      expect(feedItemCardProviderRendererMap[provider]).toBe(renderer);
      expect(renderer.cardClassNames).toBeTypeOf('function');
      expect(renderer.Preview).toBeTypeOf('function');
      expect(renderer.Supplementary).toBeTypeOf('function');
      expect(renderer.Copy).toBeTypeOf('function');
      expect(renderer.Identity).toBeTypeOf('function');
    }
  });

  it('uses no-op renderers for unsupported slots', () => {
    const model = createModel();
    const Supplementary = getFeedItemCardProviderRenderer('generic').Supplementary;
    const Copy = getFeedItemCardProviderRenderer('tiktok').Copy;
    const { container } = render(
      <>
        <Supplementary model={model} localizedPreview={null} displayHostname="" />
        <Copy model={model} localizedPreview={null} displayHostname="" />
      </>,
    );

    expect(container.firstChild).toBeNull();
  });

  it('centralizes copy visibility for all providers', () => {
    const Renderer = getFeedItemCardProviderRenderer('generic').Copy;
    const { container, rerender } = render(
      <Renderer model={createModel()} localizedPreview={null} displayHostname="example.com" />,
    );

    expect(container.querySelector('.reader-card__copy')).toBeTruthy();

    rerender(
      <Renderer
        model={createModel({
          descriptor: {
            ...createModel().descriptor,
            copy: 'none',
          },
        })}
        localizedPreview={null}
        displayHostname="example.com"
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders Instagram identity inside the provider preview', () => {
    const Preview = getFeedItemCardProviderRenderer('instagram').Preview;
    const { container } = render(
      <Preview
        model={createModel({
          provider: 'instagram',
          item: {
            id: 1,
            feedId: 2,
            link: 'https://www.instagram.com/p/example',
            title: 'inst: creator',
            text: '',
          },
          descriptor: {
            ...createModel().descriptor,
            preview: { type: 'media', isShortVideo: true, isTikTok: false },
            showInstagramIdentity: true,
          },
        })}
        localizedPreview={{ src: 'https://example.com/photo.jpg', alt: 'Photo' }}
        displayHostname=""
      />,
    );

    const preview = container.querySelector('.reader-card__preview');
    expect(preview?.querySelector('.reader-card__short-video-identity')).toBeTruthy();
    expect(container.textContent).toContain('creator');
  });

  it('falls back to standard copy when a variant-specific renderer receives another variant', () => {
    const Renderer = getFeedItemCardProviderRenderer('youtube').Copy;
    const { container } = render(
      <Renderer model={createModel()} localizedPreview={null} displayHostname="example.com" />,
    );

    expect(container.querySelector('.reader-card__youtube-copy')).toBeNull();
    expect(container.querySelector('.reader-card__copy')).toBeTruthy();
    expect(container.querySelector('.reader-card__link')?.getAttribute('href'))
      .toBe('https://example.com/story');
  });
});
