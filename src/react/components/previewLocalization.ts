import type { TFunction } from 'i18next';

import type { FeedItemPreview, FeedItemPreviewAlt } from '../domain/feedItemPreview';

export type LocalizedFeedItemPreview = Omit<FeedItemPreview, 'alt'> & { alt: string };

export function localizeFeedItemPreview(
  preview: FeedItemPreview,
  t: TFunction,
): LocalizedFeedItemPreview {
  return {
    ...preview,
    alt: getFeedItemPreviewAlt(preview.alt, t),
  };
}

function getFeedItemPreviewAlt(alt: FeedItemPreviewAlt, t: TFunction): string {
  switch (alt.kind) {
    case 'item':
      return alt.title ? t('preview.for', { title: alt.title }) : t('preview.item');
    case 'video':
      return alt.title ? t('preview.videoFor', { title: alt.title }) : t('preview.feedVideo');
    case 'youtube':
      return alt.title ? t('preview.for', { title: alt.title }) : t('preview.youtubeVideo');
    case 'tiktok':
      return alt.title ? t('preview.videoFor', { title: alt.title }) : t('preview.tiktokVideo');
    case 'twitch':
      return t('preview.twitchPreview', { channel: alt.channel });
    case 'matreshka':
      return alt.title ? t('preview.for', { title: alt.title }) : t('preview.matreshkaVideo');
    case 'vk':
      return alt.title ? t('preview.videoFor', { title: alt.title }) : t('preview.vkVideo');
  }
}
