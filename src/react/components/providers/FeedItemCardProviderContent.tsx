import { Fragment, type ReactNode } from 'react';

import type { FeedItemCardModel } from '../useFeedItemCardModel';
import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { FeedItemMediaPreview, StandardCopy, type FeedItemCardProviderRendererProps } from './providerRenderers/common';
import { HltvPreview, HltvSupplementary } from './providerRenderers/hltv';
import { InstagramPreview } from './providerRenderers/instagram';
import { LiquipediaPreview } from './providerRenderers/liquipedia';
import { MatreshkaCopy, MatreshkaVideoPreview } from './providerRenderers/matreshka';
import { OneFootballCopy, OneFootballPreview } from './providerRenderers/onefootball';
import { SasflixCopy, SasflixVideoPreview } from './providerRenderers/sasflix';
import { TikTokSupplementary } from './providerRenderers/tiktok';
import { TwitchCopy, TwitchVideoPreview } from './providerRenderers/twitch';
import { VkCopy } from './providerRenderers/vk';
import { YoutubeCopy, YoutubeVideoPreview } from './providerRenderers/youtube';

export function FeedItemCardProviderContent({
  facts,
  localizedPreview,
  displayHostname,
  previewPlaceholder,
  onOpenArticle,
}: {
  facts: FeedItemCardModel;
  localizedPreview: LocalizedFeedItemPreview | null;
  displayHostname: string;
  previewPlaceholder: ReactNode;
  onOpenArticle?: () => void;
}) {
  const props = { facts, localizedPreview, displayHostname, onOpenArticle };
  const content = renderProviderContent(props);

  return (
    <Fragment>
      {facts.isPreviewPending ? previewPlaceholder : content.preview}
      {facts.isPreviewPending ? null : content.supplementary}
      {facts.isPreviewPending || shouldHideCopy(facts) ? null : content.copy}
    </Fragment>
  );
}

function renderProviderContent(props: FeedItemCardProviderRendererProps): {
  preview: ReactNode;
  supplementary?: ReactNode;
  copy?: ReactNode;
} {
  switch (props.facts.provider) {
    case 'generic':
      return { preview: <FeedItemMediaPreview {...props} />, copy: <StandardCopy {...props} /> };
    case 'hltv':
      return { preview: <HltvPreview {...props} />, supplementary: <HltvSupplementary {...props} />, copy: <StandardCopy {...props} /> };
    case 'instagram':
      return { preview: <InstagramPreview {...props} /> };
    case 'liquipedia':
      return { preview: <LiquipediaPreview {...props} />, copy: <StandardCopy {...props} /> };
    case 'matreshka':
      return { preview: <MatreshkaVideoPreview {...props} />, copy: <MatreshkaCopy {...props} /> };
    case 'onefootball':
      return { preview: <OneFootballPreview {...props} />, copy: <OneFootballCopy {...props} /> };
    case 'sasflix':
      return { preview: <SasflixVideoPreview {...props} />, copy: <SasflixCopy {...props} /> };
    case 'tiktok':
      return { preview: <FeedItemMediaPreview {...props} />, supplementary: <TikTokSupplementary {...props} /> };
    case 'twitch':
      return { preview: <TwitchVideoPreview {...props} />, copy: <TwitchCopy {...props} /> };
    case 'vk':
      return { preview: <FeedItemMediaPreview {...props} />, copy: <VkCopy {...props} /> };
    case 'youtube':
      return { preview: <YoutubeVideoPreview {...props} />, copy: <YoutubeCopy {...props} /> };
    default:
      return assertNever(props.facts.provider);
  }
}

function shouldHideCopy(facts: FeedItemCardModel): boolean {
  return facts.provider !== 'vk'
    && (facts.imagePreview.type !== 'none'
      || facts.provider === 'instagram'
      || facts.provider === 'tiktok');
}

function assertNever(value: never): never {
  throw new Error(`Unsupported feed item provider: ${value}`);
}
