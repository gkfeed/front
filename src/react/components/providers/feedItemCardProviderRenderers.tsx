import type { ComponentType } from 'react';
import { createElement } from 'react';
import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from '../useFeedItemCardModel';
import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { InstagramIcon } from '../Icons';
import { FeedItemMedia } from '../previews/FeedItemMedia';
import { HltvCountdown, HltvMatchup } from '../previews/HltvMatch';
import { LiquipediaMatch } from '../previews/LiquipediaMatch';
import { MatreshkaPreview } from '../previews/MatreshkaPreview';
import { SasflixPreview } from '../previews/SasflixPreview';
import { TikTokComments } from '../previews/TikTokComments';
import { TwitchPreview } from '../previews/TwitchPreview';
import { TwitchTitle } from '../TwitchTitle';
import { YoutubePreview } from '../previews/YoutubePreview';
import { getTwitchStreamTitle } from '../../domain/twitchPreview';
import { parseMatreshkaTitle } from '../../domain/matreshkaTitle';
import { ArticleReaderLink } from '../ArticleReader';

export type FeedItemCardProviderRendererProps = {
  model: FeedItemCardModel;
  localizedPreview: LocalizedFeedItemPreview | null;
  displayHostname: string;
  onOpenArticle?: () => void;
};

type FeedItemCardProviderRenderer = {
  Preview: ComponentType<FeedItemCardProviderRendererProps>;
  Supplementary: ComponentType<FeedItemCardProviderRendererProps>;
  Copy: ComponentType<FeedItemCardProviderRendererProps>;
  Identity: ComponentType<FeedItemCardProviderRendererProps>;
};

export type { FeedItemCardProviderRenderer };

export function EmptyRenderer(): null {
  return null;
}

export function InstagramIdentity({ model }: FeedItemCardProviderRendererProps) {
  if (!model.descriptor.showInstagramIdentity) return null;

  return (
    <div className="reader-card__short-video-identity">
      <span className="reader-card__short-video-logo"><InstagramIcon /></span>
      <span>{getInstagramUsername(model.item.title)}</span>
    </div>
  );
}

type FeedItemCardVariantType = FeedItemCardModel['variant']['type'];

type VariantRendererProps<T extends FeedItemCardVariantType> = Omit<
  FeedItemCardProviderRendererProps,
  'model'
> & {
  model: Omit<FeedItemCardModel, 'variant'> & {
    variant: Extract<FeedItemCardModel['variant'], { type: T }>;
  };
};

export function FeedItemMediaPreview({
  model,
  localizedPreview,
  displayHostname,
}: FeedItemCardProviderRendererProps) {
  if (!localizedPreview || model.descriptor.preview.type !== 'media') return null;

  return (
    <FeedItemMedia
      href={model.item.link}
      hostname={model.item.title || displayHostname}
      preview={localizedPreview}
      isShortVideo={model.descriptor.preview.isShortVideo}
      isTikTok={model.descriptor.preview.isTikTok}
      hltvImageScore={model.hltvImageScore}
      onPreviewError={model.onPreviewError}
    />
  );
}

export function HltvPreview(props: FeedItemCardProviderRendererProps) {
  const { model } = props;
  if (model.hltvMatchTeams && model.hltvSnapshot) {
    return (
      <HltvMatchup
        teams={model.hltvMatchTeams}
        href={model.item.link}
        snapshot={model.hltvSnapshot}
      />
    );
  }

  return <FeedItemMediaPreview {...props} />;
}

export function LiquipediaPreview(props: FeedItemCardProviderRendererProps) {
  if (props.model.liquipediaMatch) {
    return <LiquipediaMatch match={props.model.liquipediaMatch} />;
  }

  return <FeedItemMediaPreview {...props} />;
}

const renderYoutubeVideoPreview = createVariantRenderer('youtube', ({
  model,
  localizedPreview,
}: VariantRendererProps<'youtube'>) => (
  <YoutubePreview
    videoId={model.variant.videoId}
    title={model.item.text || model.item.title}
    preview={localizedPreview}
    onPreviewError={model.onPreviewError}
  />
));

export function YoutubeVideoPreview(props: FeedItemCardProviderRendererProps) {
  return createElement(renderYoutubeVideoPreview, props);
}

const renderMatreshkaVideoPreview = createVariantRenderer('matreshka', ({
  model,
  localizedPreview,
}: VariantRendererProps<'matreshka'>) => {
  const matreshkaTitle = parseMatreshkaTitle(model.item.title, model.item.text);
  return (
    <MatreshkaPreview
      videoId={model.variant.videoId}
      title={matreshkaTitle.title}
      preview={localizedPreview}
      onPreviewError={model.onPreviewError}
    />
  );
});

export function MatreshkaVideoPreview(props: FeedItemCardProviderRendererProps) {
  return createElement(renderMatreshkaVideoPreview, props);
}

const renderSasflixVideoPreview = createVariantRenderer('sasflix', ({
  model,
  localizedPreview,
}: VariantRendererProps<'sasflix'>) => (
  <SasflixPreview
    href={model.item.link}
    title={model.item.title}
    videoSrc={model.openGraphPreview?.video ?? null}
    previewStatus={model.previewStatus}
    preview={localizedPreview}
    onPreviewError={model.onPreviewError}
  />
));

export function SasflixVideoPreview(props: FeedItemCardProviderRendererProps) {
  return createElement(renderSasflixVideoPreview, props);
}

const renderTwitchVideoPreview = createVariantRenderer('twitch', ({
  model,
  localizedPreview,
}: VariantRendererProps<'twitch'>) => (
  <TwitchPreview
    channel={model.variant.channel}
    preview={localizedPreview}
    onPreviewError={model.onPreviewError}
  />
));

export function TwitchVideoPreview(props: FeedItemCardProviderRendererProps) {
  return createElement(renderTwitchVideoPreview, props);
}

export function HltvSupplementary({ model }: FeedItemCardProviderRendererProps) {
  if (model.hltvMatchTeams || !model.hltvSnapshot?.startsAt) return null;
  return <HltvCountdown startsAt={model.hltvSnapshot.startsAt} />;
}

export function TikTokSupplementary({ model }: FeedItemCardProviderRendererProps) {
  return <TikTokComments item={model.item} />;
}

const renderYoutubeCopy = createVariantRenderer(
  'youtube',
  ({ model }: VariantRendererProps<'youtube'>) => (
    <div className="reader-card__copy reader-card__youtube-copy">
      <h2 className="reader-card__title">{model.item.text || model.item.title}</h2>
      <p className="reader-card__channel">{getYoutubeChannelName(model.item.title)}</p>
    </div>
  ),
  StandardCopy,
);

export function YoutubeCopy(props: FeedItemCardProviderRendererProps) {
  return createElement(renderYoutubeCopy, props);
}

const renderTwitchCopy = createVariantRenderer('twitch', ({ model }: VariantRendererProps<'twitch'>) => {
  const streamTitle = getTwitchStreamTitle(model.item.title, model.variant.channel);
  return (
    <div className="reader-card__copy reader-card__twitch-copy">
      <h2 className="reader-card__title"><TwitchTitle text={streamTitle} /></h2>
      <p className="reader-card__channel">{model.variant.channel}</p>
    </div>
  );
}, StandardCopy);

export function TwitchCopy(props: FeedItemCardProviderRendererProps) {
  return createElement(renderTwitchCopy, props);
}

const renderMatreshkaCopy = createVariantRenderer('matreshka', ({
  model,
}: VariantRendererProps<'matreshka'>) => {
  const matreshkaTitle = parseMatreshkaTitle(model.item.title, model.item.text);
  return (
    <div className="reader-card__copy reader-card__matreshka-copy">
      <h2 className="reader-card__title">{matreshkaTitle.title}</h2>
      {matreshkaTitle.channel ? (
        <p className="reader-card__channel">{matreshkaTitle.channel}</p>
      ) : null}
    </div>
  );
}, StandardCopy);

export function MatreshkaCopy(props: FeedItemCardProviderRendererProps) {
  return createElement(renderMatreshkaCopy, props);
}

const renderSasflixCopy = createVariantRenderer('sasflix', ({
  model,
}: VariantRendererProps<'sasflix'>) => (
  <div className="reader-card__copy reader-card__sasflix-copy">
    <h2 className="reader-card__title">{model.item.title}</h2>
  </div>
), StandardCopy);

export function SasflixCopy(props: FeedItemCardProviderRendererProps) {
  return createElement(renderSasflixCopy, props);
}

export function VkCopy({ model, displayHostname }: FeedItemCardProviderRendererProps) {
  if (model.preview) return null;

  const { item, description } = model;
  return (
    <div className="reader-card__copy reader-card__vk-copy">
      <h2 className="reader-card__title">{item.title || displayHostname}</h2>
      {description ? <p className="reader-card__description">{description}</p> : null}
    </div>
  );
}

export function StandardCopy({ model, displayHostname, onOpenArticle }: FeedItemCardProviderRendererProps) {
  const { t } = useTranslation();
  const { item, description } = model;

  if (model.descriptor.copy === 'simple-image') {
    return (
      <div className="reader-card__copy">
        <h2 className="reader-card__title">{item.title || displayHostname}</h2>
      </div>
    );
  }

  return (
    <div className="reader-card__copy">
      <div className="reader-card__meta">
        <span>{displayHostname}</span>
        <span>{t('feed.item')} #{item.feedId}</span>
      </div>
      <h2 className="reader-card__title">{item.title || displayHostname}</h2>
      {description ? <p className="reader-card__description">{description}</p> : null}
      <ArticleReaderLink
        url={item.link}
        enabled={
          model.openGraphPreview?.type?.toLowerCase() === 'article'
          || model.hostname === 'trashbox.ru'
          || model.hostname?.endsWith('.trashbox.ru') === true
        }
        onOpen={onOpenArticle ?? (() => {})}
      />
    </div>
  );
}

function getYoutubeChannelName(title: string): string {
  return title.replace(/^YT:\s*/i, '').trim() || 'YouTube';
}

function getInstagramUsername(title: string): string {
  return title.replace(/^inst:\s*/i, '').trim() || 'Instagram';
}

function createVariantRenderer<T extends FeedItemCardVariantType>(
  variantType: T,
  Renderer: ComponentType<VariantRendererProps<T>>,
  Fallback: ComponentType<FeedItemCardProviderRendererProps> = FeedItemMediaPreview,
): ComponentType<FeedItemCardProviderRendererProps> {
  return (props) => {
    if (props.model.variant.type !== variantType) return <Fallback {...props} />;
    return <Renderer {...props as VariantRendererProps<T>} />;
  };
}
