import type { FeedItemProvider } from './feedItemPreviewTypes';
import type { RemotePreviewSource } from './feedItemCardContracts';

export type FeedItemProviderPolicy = {
  remotePreview: RemotePreviewSource;
  livePreview: 'none' | 'hltv';
  loadingPlaceholder: 'when-missing' | 'none';
  previewMode: 'local-first' | 'tiktok-embed';
  description: 'none' | 'vk';
  metadata: 'none' | 'hltv';
};

const feedItemProviderPolicies: Record<FeedItemProvider, FeedItemProviderPolicy> = {
  generic: createProviderPolicy(),
  hltv: createProviderPolicy({ livePreview: 'hltv', metadata: 'hltv' }),
  instagram: createProviderPolicy(),
  liquipedia: createProviderPolicy({ remotePreview: 'liquipedia' }),
  matreshka: createProviderPolicy(),
  onefootball: createProviderPolicy(),
  sasflix: createProviderPolicy({ loadingPlaceholder: 'none' }),
  tiktok: createProviderPolicy({ remotePreview: 'none', previewMode: 'tiktok-embed' }),
  twitch: createProviderPolicy({ remotePreview: 'none' }),
  vk: createProviderPolicy({ description: 'vk' }),
  youtube: createProviderPolicy(),
};

function createProviderPolicy(
  overrides: Partial<FeedItemProviderPolicy> = {},
): FeedItemProviderPolicy {
  return {
    remotePreview: 'open-graph',
    livePreview: 'none',
    loadingPlaceholder: 'when-missing',
    previewMode: 'local-first',
    description: 'none',
    metadata: 'none',
    ...overrides,
  };
}

export function getFeedItemProviderPolicy(provider: FeedItemProvider): FeedItemProviderPolicy {
  return feedItemProviderPolicies[provider];
}
