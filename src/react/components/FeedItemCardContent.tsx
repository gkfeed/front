import type { FeedItemCardModel } from './useFeedItemCardModel';
import { useTranslation } from 'react-i18next';
import { localizeFeedItemPreview } from './previewLocalization';
import { HltvCountdown, HltvMatchup } from './previews/HltvMatch';
import { FeedItemMedia } from './previews/FeedItemMedia';
import { LiquipediaMatch } from './previews/LiquipediaMatch';
import { TikTokComments } from './previews/TikTokComments';
import { YoutubePreview } from './previews/YoutubePreview';

export function FeedItemCardPreview({ model }: { model: FeedItemCardModel }) {
  const { t } = useTranslation();
  const {
    item,
    hostname,
    isPreviewPending,
    hltvMatchTeams,
    variant,
    visiblePreview,
    hltvImageScore,
    onPreviewError,
    liquipediaMatch,
  } = model;
  const isShortVideo = variant.type === 'tiktok' || variant.type === 'instagram';
  const isTikTok = variant.type === 'tiktok';
  const localizedPreview = visiblePreview ? localizeFeedItemPreview(visiblePreview, t) : null;
  const displayHostname = hostname ?? t('feed.item');

  if (isPreviewPending) {
    return <div className="reader-card__preview-placeholder" role="status" aria-label={t('preview.loading')} />;
  }
  if (hltvMatchTeams) {
    return (
      <HltvMatchup
        teams={hltvMatchTeams}
        href={item.link}
        score={model.openGraphPreview?.matchScore}
        isLive={model.openGraphPreview?.matchStatus === 'live'}
        currentMap={model.openGraphPreview?.matchCurrentMap}
        completedMaps={model.openGraphPreview?.matchCompletedMaps}
        playerStats={model.openGraphPreview?.matchPlayerStats}
        teamSides={model.openGraphPreview?.matchTeamSides}
      />
    );
  }
  if (variant.type === 'youtube') {
    return (
      <YoutubePreview
        videoId={variant.videoId}
        title={item.text || item.title}
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
      isShortVideo={isShortVideo}
      isTikTok={isTikTok}
      hltvImageScore={hltvImageScore}
      onPreviewError={onPreviewError}
    />
  );
}

export function FeedItemCardSupplementary({ model }: { model: FeedItemCardModel }) {
  const { item, isPreviewPending, variant, provider, openGraphPreview } = model;
  return (
    <>
      {!isPreviewPending && provider === 'hltv' && openGraphPreview?.matchStartsAt ? (
        <HltvCountdown startsAt={openGraphPreview.matchStartsAt} />
      ) : null}
      {!isPreviewPending && variant.type === 'tiktok' ? <TikTokComments item={item} /> : null}
    </>
  );
}

export function FeedItemCardCopy({ model }: { model: FeedItemCardModel }) {
  const { t } = useTranslation();
  const {
    item,
    hostname,
    isPreviewPending,
    variant,
    imagePreview,
    description,
  } = model;
  const displayHostname = hostname ?? t('feed.item');
  const isShortVideo = variant.type === 'tiktok' || variant.type === 'instagram';

  if (isPreviewPending || imagePreview.type !== 'none' || isShortVideo) return null;
  if (variant.type === 'youtube') {
    return (
      <div className="reader-card__youtube-copy">
        <h2 className="reader-card__title">{item.text || item.title}</h2>
        <p className="reader-card__channel">{getYoutubeChannelName(item.title)}</p>
      </div>
    );
  }
  if (variant.type === 'simple-image') {
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
