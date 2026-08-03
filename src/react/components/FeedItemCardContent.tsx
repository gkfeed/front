import type { FeedItemCardModel } from './useFeedItemCardModel';
import { getTwitchStreamTitle } from '../domain/twitchPreview';
import { useTranslation } from 'react-i18next';
import { localizeFeedItemPreview } from './previewLocalization';
import { HltvCountdown, HltvMatchup } from './previews/HltvMatch';
import { FeedItemMedia } from './previews/FeedItemMedia';
import { LiquipediaMatch } from './previews/LiquipediaMatch';
import { MatreshkaPreview } from './previews/MatreshkaPreview';
import { TikTokComments } from './previews/TikTokComments';
import { TwitchPreview } from './previews/TwitchPreview';
import { TwitchTitle } from './TwitchTitle';
import { YoutubePreview } from './previews/YoutubePreview';
import { parseMatreshkaTitle } from '../domain/matreshkaTitle';

export function FeedItemCardPreview({ model }: { model: FeedItemCardModel }) {
  const { t } = useTranslation();
  const {
    item,
    hostname,
    isPreviewPending,
    descriptor,
    hltvMatchTeams,
    hltvSnapshot,
    visiblePreview,
    hltvImageScore,
    onPreviewError,
    liquipediaMatch,
  } = model;
  const { preview } = descriptor;
  const localizedPreview = visiblePreview ? localizeFeedItemPreview(visiblePreview, t) : null;
  const displayHostname = hostname ?? t('feed.item');

  if (isPreviewPending) {
    return <div className="reader-card__preview-placeholder" role="status" aria-label={t('preview.loading')} />;
  }
  if (hltvMatchTeams && hltvSnapshot) {
    return (
      <HltvMatchup
        teams={hltvMatchTeams}
        href={item.link}
        snapshot={hltvSnapshot}
      />
    );
  }
  if (preview.type === 'youtube') {
    return (
      <YoutubePreview
        videoId={preview.videoId}
        title={item.text || item.title}
        preview={localizedPreview}
        onPreviewError={onPreviewError}
      />
    );
  }
  if (preview.type === 'matreshka') {
    const matreshkaTitle = parseMatreshkaTitle(item.title, item.text);
    return (
      <MatreshkaPreview
        videoId={preview.videoId}
        title={matreshkaTitle.title}
        preview={localizedPreview}
        onPreviewError={onPreviewError}
      />
    );
  }
  if (preview.type === 'twitch') {
    return (
      <TwitchPreview
        channel={preview.channel}
        preview={localizedPreview}
        onPreviewError={onPreviewError}
      />
    );
  }
  if (liquipediaMatch) return <LiquipediaMatch match={liquipediaMatch} />;
  if (!localizedPreview) return null;

  return (
    <FeedItemMedia
      href={item.link}
      hostname={item.title || displayHostname}
      preview={localizedPreview}
      isShortVideo={preview.isShortVideo}
      isTikTok={preview.isTikTok}
      hltvImageScore={hltvImageScore}
      onPreviewError={onPreviewError}
    />
  );
}

export function FeedItemCardSupplementary({ model }: { model: FeedItemCardModel }) {
  const { item, isPreviewPending, descriptor, hltvSnapshot } = model;
  if (isPreviewPending) return null;

  return (
    <>
      {descriptor.showHltvCountdown && hltvSnapshot?.startsAt ? (
        <HltvCountdown startsAt={hltvSnapshot.startsAt} />
      ) : null}
      {descriptor.showTikTokComments ? <TikTokComments item={item} /> : null}
    </>
  );
}

export function FeedItemCardCopy({ model }: { model: FeedItemCardModel }) {
  const { t } = useTranslation();
  const {
    item,
    hostname,
    isPreviewPending,
    descriptor,
    description,
    variant,
  } = model;

  if (isPreviewPending || descriptor.copy === 'none') return null;
  const displayHostname = hostname ?? t('feed.item');
  if (descriptor.copy === 'youtube') {
    return (
      <div className="reader-card__youtube-copy">
        <h2 className="reader-card__title">{item.text || item.title}</h2>
        <p className="reader-card__channel">{getYoutubeChannelName(item.title)}</p>
      </div>
    );
  }
  if (descriptor.copy === 'twitch') {
    const streamTitle = variant.type === 'twitch'
      ? getTwitchStreamTitle(item.title, variant.channel)
      : item.title || item.text;

    return (
      <div className="reader-card__twitch-copy">
        <h2 className="reader-card__title"><TwitchTitle text={streamTitle} /></h2>
      </div>
    );
  }
  if (descriptor.copy === 'matreshka') {
    const matreshkaTitle = parseMatreshkaTitle(item.title, item.text);
    return (
      <div className="reader-card__copy reader-card__matreshka-copy">
        <h2 className="reader-card__title">{matreshkaTitle.title}</h2>
        {matreshkaTitle.channel ? (
          <p className="reader-card__channel">{matreshkaTitle.channel}</p>
        ) : null}
      </div>
    );
  }
  if (descriptor.copy === 'simple-image') {
    return <h2 className="reader-card__title">{item.title || displayHostname}</h2>;
  }

  return (
    <>
      <div className="reader-card__meta">
        <span>{displayHostname}</span>
        <span>{t('feed.item')} #{item.feedId}</span>
      </div>
      <h2 className="reader-card__title">{item.title || displayHostname}</h2>
      {description ? <p className="reader-card__description">{description}</p> : null}
      <a className="reader-card__link" href={item.link} target="_blank" rel="noreferrer">
        {t('reader.openOriginal')} <span aria-hidden="true">↗</span>
      </a>
    </>
  );
}

function getYoutubeChannelName(title: string): string {
  return title.replace(/^YT:\s*/i, '').trim() || 'YouTube';
}
