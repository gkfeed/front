import {
  isHltvMatchUrl,
  isLiquipediaMatchUrl,
  isOneFootballMatchUrl,
  isTikTokVideoUrl,
  isVkHost,
} from '../../../shared/urlRules';

import type { FeedItem } from '../types';
import type { RemotePreviewSource } from './feedItemCardContracts';
import { isInstagramMediaUrl } from './instagramPreview';
import type { FeedItemProvider } from './feedItemPreviewTypes';
import {
  getMatreshkaVideoId,
  getSasflixPublicationId,
  getYoutubeVideoId,
  isRedditUrl,
  isRezkaUrl,
  parseUrl,
} from './feedItemUrls';
import { getSpotifyEmbed } from './spotifyPreview';
import { getTwitchChannel } from './twitchPreview';

export type FeedItemProviderLoadingRules = {
  remotePreview: RemotePreviewSource;
  livePreview: 'none' | 'hltv';
  loadingPlaceholder: 'always' | 'when-missing' | 'none';
  previewMode: 'local-first' | 'tiktok-embed';
  description: 'none' | 'vk';
  metadata: 'none' | 'hltv';
};

export type FeedPluginId = Exclude<FeedItemProvider, 'generic'>;

export type PluginSettingDefinition =
  | {
    id: string;
    type: 'boolean';
    defaultValue: boolean;
    labelKey: string;
  }
  | {
    id: string;
    type: 'select';
    defaultValue: string;
    labelKey: string;
    options: readonly { value: string; labelKey: string }[];
  };

export type FeedItemProviderDefinition = {
  id: FeedPluginId;
  title: string;
  matches: (item: FeedItem, url: URL | null) => boolean;
  matchesLegacy?: (item: FeedItem, url: URL | null) => boolean;
  loading: FeedItemProviderLoadingRules;
  live?: true;
  settings?: readonly PluginSettingDefinition[];
};

type FeedItemProviderResource = Pick<FeedItemProviderDefinition, 'matches' | 'loading'>
  & Partial<Pick<FeedItemProviderDefinition, 'id' | 'title' | 'matchesLegacy' | 'live' | 'settings'>>;

const defaultLoadingRules: FeedItemProviderLoadingRules = {
  remotePreview: 'open-graph',
  livePreview: 'none',
  loadingPlaceholder: 'when-missing',
  previewMode: 'local-first',
  description: 'none',
  metadata: 'none',
};

function defineProvider(
  id: FeedPluginId,
  title: string,
  overrides: {
    matches?: FeedItemProviderDefinition['matches'];
    matchesLegacy?: FeedItemProviderDefinition['matchesLegacy'];
    loading?: Partial<FeedItemProviderLoadingRules>;
    live?: true;
    settings?: readonly PluginSettingDefinition[];
  } = {},
): FeedItemProviderDefinition {
  return {
    id,
    title,
    matches: overrides.matches ?? (() => false),
    matchesLegacy: overrides.matchesLegacy,
    loading: { ...defaultLoadingRules, ...overrides.loading },
    live: overrides.live,
    settings: overrides.settings,
  };
}

/** Provider detection and the loading facts needed before a remote response exists. */
export const feedItemProviderResources = {
  generic: { matches: () => false, loading: defaultLoadingRules },
  hltv: defineProvider('hltv', 'HLTV', {
    matches: (_item, url) => Boolean(url && isHltvMatchUrl(url)),
    loading: { livePreview: 'hltv', metadata: 'hltv' },
    live: true,
  }),
  instagram: defineProvider('instagram', 'Instagram', {
    matches: (_item, url) => Boolean(url && isInstagramMediaUrl(url)),
    matchesLegacy: (item) => /^inst:\s*/i.test(item.title),
  }),
  liquipedia: defineProvider('liquipedia', 'Liquipedia', {
    matches: (_item, url) => Boolean(url && isLiquipediaMatchUrl(url)),
    loading: { remotePreview: 'liquipedia' },
  }),
  matreshka: defineProvider('matreshka', 'Matreshka', {
    matches: (_item, url) => Boolean(url && getMatreshkaVideoId(url)),
  }),
  onefootball: defineProvider('onefootball', 'OneFootball', {
    matches: (_item, url) => Boolean(url && isOneFootballMatchUrl(url)),
    loading: { loadingPlaceholder: 'always' },
    live: true,
  }),
  reddit: defineProvider('reddit', 'Reddit', {
    matches: (_item, url) => isRedditUrl(url),
  }),
  rezka: defineProvider('rezka', 'Rezka', {
    matches: (_item, url) => isRezkaUrl(url),
  }),
  sasflix: defineProvider('sasflix', 'Sasflix', {
    matches: (_item, url) => Boolean(url && getSasflixPublicationId(url)),
    loading: { loadingPlaceholder: 'none' },
  }),
  spotify: defineProvider('spotify', 'Spotify', {
    matches: (_item, url) => Boolean(url && getSpotifyEmbed(url.href)),
  }),
  tiktok: defineProvider('tiktok', 'TikTok', {
    matches: (_item, url) => Boolean(url && isTikTokVideoUrl(url)),
    loading: { remotePreview: 'none', previewMode: 'tiktok-embed' },
    settings: [
      {
        id: 'hideItems',
        type: 'boolean',
        defaultValue: false,
        labelKey: 'settings.tiktokItems',
      },
      {
        id: 'playbackMode',
        type: 'select',
        defaultValue: 'embed',
        labelKey: 'settings.tiktokPlayback',
        options: [
          { value: 'embed', labelKey: 'settings.tiktokEmbed' },
          { value: 'preview', labelKey: 'settings.tiktokPreview' },
        ],
      },
    ],
  }),
  twitch: defineProvider('twitch', 'Twitch', {
    matches: (_item, url) => Boolean(url && getTwitchChannel(url)),
    loading: { remotePreview: 'none' },
    live: true,
  }),
  vk: defineProvider('vk', 'VK', {
    matches: (_item, url) => Boolean(url && isVkHost(url.hostname)),
    loading: { description: 'vk' },
  }),
  youtube: defineProvider('youtube', 'YouTube', {
    matches: (_item, url) => Boolean(url && getYoutubeVideoId(url)),
  }),
} satisfies Readonly<Record<FeedItemProvider, FeedItemProviderResource>>;

const detectedProviders: readonly FeedPluginId[] = [
  'matreshka',
  'sasflix',
  'youtube',
  'twitch',
  'tiktok',
  'instagram',
  'vk',
  'hltv',
  'onefootball',
  'liquipedia',
  'reddit',
  'rezka',
  'spotify',
];

export const feedPluginCatalog: readonly FeedItemProviderDefinition[] = detectedProviders
  .map((provider) => feedItemProviderResources[provider]);

export function getFeedItemProvider(item: FeedItem): FeedItemProvider {
  return getFeedItemProviderFromUrl(item, parseUrl(item.link));
}

export function getFeedItemProviderFromUrl(
  item: FeedItem,
  url: URL | null,
  disabledPlugins: ReadonlySet<FeedPluginId> = new Set(),
): FeedItemProvider {
  const matched = feedPluginCatalog.find((plugin) => plugin.matches(item, url))
    ?? feedPluginCatalog.find((plugin) => plugin.matchesLegacy?.(item, url));
  if (!matched || disabledPlugins.has(matched.id)) return 'generic';
  return matched.id;
}

export function getFeedItemProviderLoadingRules(
  provider: FeedItemProvider,
): FeedItemProviderLoadingRules {
  return feedItemProviderResources[provider].loading;
}

export function isYoutubeFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'youtube';
}

export function isTikTokFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'tiktok';
}

export function isInstagramFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'instagram';
}

export function isShortVideoFeedItem(item: FeedItem): boolean {
  const provider = getFeedItemProvider(item);
  return provider === 'instagram' || provider === 'tiktok';
}

export function isVkFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'vk';
}

export function isHltvFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'hltv';
}

export function isLiquipediaFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'liquipedia';
}
