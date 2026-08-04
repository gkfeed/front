import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from '../useFeedItemCardModel';
import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { FeedItemMedia } from '../previews/FeedItemMedia';
import { HltvCountdown, HltvMatchup } from '../previews/HltvMatch';
import { LiquipediaMatch } from '../previews/LiquipediaMatch';
import { MatreshkaPreview } from '../previews/MatreshkaPreview';
import { TikTokComments } from '../previews/TikTokComments';
import { TwitchPreview } from '../previews/TwitchPreview';
import { TwitchTitle } from '../TwitchTitle';
import { YoutubePreview } from '../previews/YoutubePreview';
import { getTwitchStreamTitle } from '../../domain/twitchPreview';
import { parseMatreshkaTitle } from '../../domain/matreshkaTitle';

export type FeedItemCardProviderRendererProps = {
  model: FeedItemCardModel;
  localizedPreview: LocalizedFeedItemPreview | null;
  displayHostname: string;
};

type FeedItemCardProviderRenderer = {
  Preview: ComponentType<FeedItemCardProviderRendererProps>;
  Supplementary: ComponentType<FeedItemCardProviderRendererProps>;
  Copy: ComponentType<FeedItemCardProviderRendererProps>;
};

export type { FeedItemCardProviderRenderer };

export function EmptyRenderer(): null {
  return null;
}

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

export function YoutubeVideoPreview(props: FeedItemCardProviderRendererProps) {
  const { model, localizedPreview } = props;
  if (model.variant.type !== 'youtube') return <FeedItemMediaPreview {...props} />;

  return (
    <YoutubePreview
      videoId={model.variant.videoId}
      title={model.item.text || model.item.title}
      preview={localizedPreview}
      onPreviewError={model.onPreviewError}
    />
  );
}

export function MatreshkaVideoPreview(props: FeedItemCardProviderRendererProps) {
  const { model, localizedPreview } = props;
  if (model.variant.type !== 'matreshka') return <FeedItemMediaPreview {...props} />;

  const matreshkaTitle = parseMatreshkaTitle(model.item.title, model.item.text);
  return (
    <MatreshkaPreview
      videoId={model.variant.videoId}
      title={matreshkaTitle.title}
      preview={localizedPreview}
      onPreviewError={model.onPreviewError}
    />
  );
}

export function TwitchVideoPreview(props: FeedItemCardProviderRendererProps) {
  const { model, localizedPreview } = props;
  if (model.variant.type !== 'twitch') return <FeedItemMediaPreview {...props} />;

  return (
    <TwitchPreview
      channel={model.variant.channel}
      preview={localizedPreview}
      onPreviewError={model.onPreviewError}
    />
  );
}

export function HltvSupplementary({ model }: FeedItemCardProviderRendererProps) {
  if (model.hltvMatchTeams || !model.hltvSnapshot?.startsAt) return null;
  return <HltvCountdown startsAt={model.hltvSnapshot.startsAt} />;
}

export function TikTokSupplementary({ model }: FeedItemCardProviderRendererProps) {
  return <TikTokComments item={model.item} />;
}

export function YoutubeCopy({ model }: FeedItemCardProviderRendererProps) {
  return (
    <div className="reader-card__copy reader-card__youtube-copy">
      <h2 className="reader-card__title">{model.item.text || model.item.title}</h2>
      <p className="reader-card__channel">{getYoutubeChannelName(model.item.title)}</p>
    </div>
  );
}

export function TwitchCopy({ model }: FeedItemCardProviderRendererProps) {
  const streamTitle = model.variant.type === 'twitch'
    ? getTwitchStreamTitle(model.item.title, model.variant.channel)
    : model.item.title || model.item.text;

  return (
    <div className="reader-card__copy reader-card__twitch-copy">
      <h2 className="reader-card__title"><TwitchTitle text={streamTitle} /></h2>
    </div>
  );
}

export function MatreshkaCopy({ model }: FeedItemCardProviderRendererProps) {
  const matreshkaTitle = parseMatreshkaTitle(model.item.title, model.item.text);
  return (
    <div className="reader-card__copy reader-card__matreshka-copy">
      <h2 className="reader-card__title">{matreshkaTitle.title}</h2>
      {matreshkaTitle.channel ? (
        <p className="reader-card__channel">{matreshkaTitle.channel}</p>
      ) : null}
    </div>
  );
}

export function StandardCopy({ model, displayHostname }: FeedItemCardProviderRendererProps) {
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
      <a className="reader-card__link" href={item.link} target="_blank" rel="noreferrer">
        {t('reader.openOriginal')} <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

function getYoutubeChannelName(title: string): string {
  return title.replace(/^YT:\s*/i, '').trim() || 'YouTube';
}
