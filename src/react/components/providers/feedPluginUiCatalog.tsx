import { lazy, useState, type ComponentType } from 'react';

import type { FeedPluginId } from '../../domain/feedItemProviderPresentation';
import { FeedItemMediaPreview, FeedPluginCardSlots, StandardCopy, type FeedItemCardProviderRendererProps, type FeedPluginCardContent, type ProviderRendererProps } from './providerRenderers/common';

type PluginUi<Id extends FeedPluginId> = {
  renderCard: (props: ProviderRendererProps<Id>) => FeedPluginCardContent;
};

/** UI capabilities stay separate from the React-free plugin core. */
export function definePluginUi<Id extends FeedPluginId>(id: Id, load: () => Promise<PluginUi<Id>>) {
  let ready: PluginUi<Id> | undefined;
  let pending: Promise<PluginUi<Id>> | undefined;
  const loadUi = () => {
    if (!pending) {
      pending = load().then((ui) => {
        ready = ui;
        return ui;
      }).catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
  function PluginCard(props: FeedItemCardProviderRendererProps) {
    if (props.facts.provider !== id) throw new Error(`Invalid card payload for ${id}`);
    // The id check narrows the tagged union at this single dispatch boundary.
    const slots = ready!.renderCard(props as ProviderRendererProps<Id>);
    return <FeedPluginCardSlots {...props} {...slots} />;
  }
  const LazyCard = lazy(async () => {
    await loadUi();
    return { default: PluginCard };
  });
  function Card(props: FeedItemCardProviderRendererProps) {
    // Keep the same component tree if the import resolves after this card mounted.
    const [wasPrefetched] = useState(() => Boolean(ready));
    return wasPrefetched ? <PluginCard {...props} /> : <LazyCard {...props} />;
  }
  return { loadUi, Card };
}

const standardUi = async () => ({
  renderCard: (props: FeedItemCardProviderRendererProps) => ({
    preview: <FeedItemMediaPreview {...props} />, copy: <StandardCopy {...props} />,
  }),
});

export const feedPluginUiCatalog = {
  hltv: definePluginUi('hltv', async () => {
    const { HltvPreview, HltvSupplementary } = await import('./providerRenderers/hltv');
    return { renderCard: (props) => ({ preview: <HltvPreview {...props} />, supplementary: <HltvSupplementary {...props} />, copy: <StandardCopy {...props} /> }) };
  }),
  instagram: definePluginUi('instagram', async () => {
    const { InstagramPreview } = await import('./providerRenderers/instagram');
    return { renderCard: (props) => ({ preview: <InstagramPreview {...props} /> }) };
  }),
  liquipedia: definePluginUi('liquipedia', async () => {
    const { LiquipediaPreview } = await import('./providerRenderers/liquipedia');
    return { renderCard: (props) => ({ preview: <LiquipediaPreview {...props} />, copy: props.facts.liquipediaMatch ? null : <StandardCopy {...props} /> }) };
  }),
  liveball: definePluginUi('liveball', standardUi),
  matreshka: definePluginUi('matreshka', async () => {
    const { MatreshkaVideoPreview, MatreshkaCopy } = await import('./providerRenderers/matreshka');
    return { renderCard: (props) => ({ preview: <MatreshkaVideoPreview {...props} />, copy: <MatreshkaCopy {...props} /> }) };
  }),
  onefootball: definePluginUi('onefootball', async () => {
    const { OneFootballPreview, OneFootballCopy } = await import('./providerRenderers/onefootball');
    return { renderCard: (props) => ({ preview: <OneFootballPreview {...props} />, copy: <OneFootballCopy {...props} /> }) };
  }),
  reddit: definePluginUi('reddit', async () => {
    const { RedditPreview, RedditCopy } = await import('./providerRenderers/reddit');
    return { renderCard: (props) => ({ preview: <RedditPreview {...props} />, copy: <RedditCopy {...props} /> }) };
  }),
  rezka: definePluginUi('rezka', standardUi),
  sasflix: definePluginUi('sasflix', async () => {
    const { SasflixVideoPreview, SasflixCopy } = await import('./providerRenderers/sasflix');
    return { renderCard: (props) => ({ preview: <SasflixVideoPreview {...props} />, copy: <SasflixCopy {...props} /> }) };
  }),
  spotify: definePluginUi('spotify', standardUi),
  tiktok: definePluginUi('tiktok', async () => {
    const { TikTokSupplementary } = await import('./providerRenderers/tiktok');
    return { renderCard: (props) => ({ preview: <FeedItemMediaPreview {...props} />, supplementary: <TikTokSupplementary {...props} /> }) };
  }),
  twitch: definePluginUi('twitch', async () => {
    const { TwitchVideoPreview, TwitchCopy } = await import('./providerRenderers/twitch');
    return { renderCard: (props) => ({ preview: <TwitchVideoPreview {...props} />, copy: <TwitchCopy {...props} /> }) };
  }),
  vk: definePluginUi('vk', async () => {
    const { VkDeletedPreview, VkCopy } = await import('./providerRenderers/vk');
    const { VkImageCarousel } = await import('../previews/VkImageCarousel');
    return { renderCard: (props) => ({
      preview: props.facts.vkStatus === 'deleted' ? <VkDeletedPreview facts={props.facts} />
        : props.localizedPreview && props.localizedPreview.type === undefined && (props.localizedPreview.imageUrls?.length ?? 0) > 1
          ? <VkImageCarousel key={props.facts.item.link} href={props.facts.item.link} preview={props.localizedPreview} onPreviewError={props.facts.onPreviewError} />
          : <FeedItemMediaPreview {...props} />,
      copy: <VkCopy {...props} />,
    }) };
  }),
  youtube: definePluginUi('youtube', async () => {
    const { YoutubeVideoPreview, YoutubeCopy } = await import('./providerRenderers/youtube');
    return { renderCard: (props) => ({ preview: <YoutubeVideoPreview {...props} />, copy: <YoutubeCopy {...props} /> }) };
  }),
} satisfies Record<FeedPluginId, { Card: ComponentType<FeedItemCardProviderRendererProps> }>;
