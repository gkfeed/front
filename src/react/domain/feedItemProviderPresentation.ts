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
import type { FeedItemProvider, FeedItemProviderIdentity } from './feedItemPreviewTypes';
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
    legacyStorageKey?: string;
  }
  | {
    id: string;
    type: 'select';
    defaultValue: string;
    labelKey: string;
    legacyStorageKey?: string;
    options: readonly { value: string; labelKey: string }[];
  };

export type FeedItemProviderDefinition<Id extends FeedPluginId = FeedPluginId> = {
  id: Id;
  title: string;
  matches: (item: FeedItem, url: URL | null) => boolean;
  matchesLegacy?: (item: FeedItem, url: URL | null) => boolean;
  loading: FeedItemProviderLoadingRules;
  analyze: (item: FeedItem, url: URL | null) => Extract<FeedItemProviderIdentity, { provider: Id }>;
  live?: true;
  settings?: readonly PluginSettingDefinition[];
  settingsVersion: number;
};

type FeedItemProviderResource = Pick<FeedItemProviderDefinition, 'matches' | 'loading'> & {
  analyze: (item: FeedItem, url: URL | null) => FeedItemProviderIdentity;
}
  & Partial<Pick<FeedItemProviderDefinition, 'id' | 'title' | 'matchesLegacy' | 'live' | 'settings'>>;

const defaultLoadingRules: FeedItemProviderLoadingRules = {
  remotePreview: 'open-graph',
  livePreview: 'none',
  loadingPlaceholder: 'when-missing',
  previewMode: 'local-first',
  description: 'none',
  metadata: 'none',
};

export function defineFeedPlugin<Id extends FeedPluginId>(
  id: Id,
  title: string,
  overrides: {
    analyze: FeedItemProviderDefinition<NoInfer<Id>>['analyze'];
    matches?: FeedItemProviderDefinition['matches'];
    matchesLegacy?: FeedItemProviderDefinition['matchesLegacy'];
    loading?: Partial<FeedItemProviderLoadingRules>;
    live?: true;
    settings?: readonly PluginSettingDefinition[];
    settingsVersion?: number;
  },
): FeedItemProviderDefinition<Id> {
  return {
    id,
    title,
    matches: overrides.matches ?? (() => false),
    matchesLegacy: overrides.matchesLegacy,
    loading: { ...defaultLoadingRules, ...overrides.loading },
    live: overrides.live,
    settings: overrides.settings,
    analyze: overrides.analyze,
    settingsVersion: overrides.settingsVersion ?? 1,
  };
}

/** Provider detection and the loading facts needed before a remote response exists. */
export const feedItemProviderResources = {
  generic: { matches: () => false, loading: defaultLoadingRules, analyze: () => ({ provider: 'generic', simpleImage: false } as const) },
  hltv: defineFeedPlugin('hltv', 'HLTV', {
    analyze: () => ({ provider: 'hltv' }),
    matches: (_item, url) => Boolean(url && isHltvMatchUrl(url)),
    loading: { livePreview: 'hltv', metadata: 'hltv' },
    live: true,
  }),
  instagram: defineFeedPlugin('instagram', 'Instagram', {
    analyze: () => ({ provider: 'instagram', media: 'video' }),
    matches: (_item, url) => Boolean(url && isInstagramMediaUrl(url)),
    matchesLegacy: (item) => /^inst:\s*/i.test(item.title),
  }),
  liquipedia: defineFeedPlugin('liquipedia', 'Liquipedia', {
    analyze: () => ({ provider: 'liquipedia' }),
    matches: (_item, url) => Boolean(url && isLiquipediaMatchUrl(url)),
    loading: { remotePreview: 'liquipedia' },
  }),
  matreshka: defineFeedPlugin('matreshka', 'Matreshka', {
    analyze: (_item, url) => ({ provider: 'matreshka', videoId: requirePayload(url && getMatreshkaVideoId(url), 'matreshka') }),
    matches: (_item, url) => Boolean(url && getMatreshkaVideoId(url)),
  }),
  onefootball: defineFeedPlugin('onefootball', 'OneFootball', {
    analyze: () => ({ provider: 'onefootball', simpleImage: false }),
    matches: (_item, url) => Boolean(url && isOneFootballMatchUrl(url)),
    loading: { loadingPlaceholder: 'always' },
    live: true,
  }),
  reddit: defineFeedPlugin('reddit', 'Reddit', {
    analyze: () => ({ provider: 'reddit', simpleImage: false }),
    matches: (_item, url) => isRedditUrl(url),
  }),
  rezka: defineFeedPlugin('rezka', 'Rezka', {
    analyze: () => ({ provider: 'rezka', simpleImage: false }),
    matches: (_item, url) => isRezkaUrl(url),
  }),
  sasflix: defineFeedPlugin('sasflix', 'Sasflix', {
    analyze: (_item, url) => ({ provider: 'sasflix', publicationId: requirePayload(url && getSasflixPublicationId(url), 'sasflix') }),
    matches: (_item, url) => Boolean(url && getSasflixPublicationId(url)),
    loading: { loadingPlaceholder: 'none' },
  }),
  spotify: defineFeedPlugin('spotify', 'Spotify', {
    analyze: () => ({ provider: 'spotify', simpleImage: false }),
    matches: (_item, url) => Boolean(url && getSpotifyEmbed(url.href)),
  }),
  tiktok: defineFeedPlugin('tiktok', 'TikTok', {
    analyze: () => ({ provider: 'tiktok' }),
    matches: (_item, url) => Boolean(url && isTikTokVideoUrl(url)),
    loading: { remotePreview: 'none', previewMode: 'tiktok-embed' },
    settings: [
      {
        id: 'hideItems',
        type: 'boolean',
        defaultValue: false,
        labelKey: 'settings.tiktokItems',
        legacyStorageKey: 'gkfeed.hideTikTokItems',
      },
      {
        id: 'playbackMode',
        type: 'select',
        defaultValue: 'embed',
        labelKey: 'settings.tiktokPlayback',
        legacyStorageKey: 'gkfeed.tiktokPlaybackMode',
        options: [
          { value: 'embed', labelKey: 'settings.tiktokEmbed' },
          { value: 'preview', labelKey: 'settings.tiktokPreview' },
        ],
      },
    ],
  }),
  twitch: defineFeedPlugin('twitch', 'Twitch', {
    analyze: (_item, url) => ({ provider: 'twitch', channel: requirePayload(url && getTwitchChannel(url), 'twitch') }),
    matches: (_item, url) => Boolean(url && getTwitchChannel(url)),
    loading: { remotePreview: 'none' },
    live: true,
  }),
  vk: defineFeedPlugin('vk', 'VK', {
    analyze: () => ({ provider: 'vk' }),
    matches: (_item, url) => Boolean(url && isVkHost(url.hostname)),
    loading: { description: 'vk' },
  }),
  youtube: defineFeedPlugin('youtube', 'YouTube', {
    analyze: (_item, url) => ({ provider: 'youtube', videoId: requirePayload(url && getYoutubeVideoId(url), 'youtube') }),
    matches: (_item, url) => Boolean(url && getYoutubeVideoId(url)),
  }),
} satisfies Readonly<Record<FeedItemProvider, FeedItemProviderResource>>;

function requirePayload(value: string | null, provider: FeedPluginId): string {
  if (value) return value;
  throw new Error(`Missing payload for detected ${provider} feed item`);
}

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

type BuiltInFeedPlugin = { [Id in FeedPluginId]: FeedItemProviderDefinition<Id> }[FeedPluginId];

export const feedPluginCatalog: readonly BuiltInFeedPlugin[] = detectedProviders
  .map((provider) => feedItemProviderResources[provider]);

export function getFeedItemProvider(item: FeedItem, disabledPlugins?: ReadonlySet<FeedPluginId>): FeedItemProvider {
  return getFeedItemProviderFromUrl(item, parseUrl(item.link), disabledPlugins);
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

export function isTikTokFeedItem(item: FeedItem, disabledPlugins?: ReadonlySet<FeedPluginId>): boolean {
  return getFeedItemProvider(item, disabledPlugins) === 'tiktok';
}

export function isInstagramFeedItem(item: FeedItem): boolean {
  return getFeedItemProvider(item) === 'instagram';
}

export function isShortVideoFeedItem(item: FeedItem, disabledPlugins?: ReadonlySet<FeedPluginId>): boolean {
  const provider = getFeedItemProvider(item, disabledPlugins);
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
