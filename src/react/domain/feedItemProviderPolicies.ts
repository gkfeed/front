import type { FeedItemProvider } from './feedItemPreviewTypes';

export type FeedItemProviderPolicy = {
  remotePreview: boolean;
  previewMode: 'local-first' | 'tiktok-embed';
  description: 'none' | 'vk';
  metadata: 'none' | 'hltv';
};

const feedItemProviderPolicies: Record<FeedItemProvider, FeedItemProviderPolicy> = {
  generic: { remotePreview: true, previewMode: 'local-first', description: 'none', metadata: 'none' },
  hltv: { remotePreview: true, previewMode: 'local-first', description: 'none', metadata: 'hltv' },
  instagram: { remotePreview: true, previewMode: 'local-first', description: 'none', metadata: 'none' },
  liquipedia: { remotePreview: true, previewMode: 'local-first', description: 'none', metadata: 'none' },
  matreshka: { remotePreview: true, previewMode: 'local-first', description: 'none', metadata: 'none' },
  sasflix: { remotePreview: true, previewMode: 'local-first', description: 'none', metadata: 'none' },
  tiktok: { remotePreview: false, previewMode: 'tiktok-embed', description: 'none', metadata: 'none' },
  twitch: { remotePreview: false, previewMode: 'local-first', description: 'none', metadata: 'none' },
  vk: { remotePreview: true, previewMode: 'local-first', description: 'vk', metadata: 'none' },
  youtube: { remotePreview: true, previewMode: 'local-first', description: 'none', metadata: 'none' },
};

export function getFeedItemProviderPolicy(provider: FeedItemProvider): FeedItemProviderPolicy {
  return feedItemProviderPolicies[provider];
}
