import type { FeedItemCardModel } from './useFeedItemCardModel';
import { useTranslation } from 'react-i18next';
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
    isYoutube,
    youtubeVideoId,
    visiblePreview,
    isShortVideo,
    isTikTok,
    hltvImageScore,
    onPreviewError,
    liquipediaMatch,
  } = model;

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
  if (isYoutube && youtubeVideoId) {
    return (
      <YoutubePreview
        videoId={youtubeVideoId}
        title={item.text || item.title}
        preview={visiblePreview}
        onPreviewError={onPreviewError}
      />
    );
  }
  if (liquipediaMatch) return <LiquipediaMatch match={liquipediaMatch} />;
  if (!visiblePreview) return null;

  return (
    <FeedItemMedia
      href={item.link}
      hostname={item.title || hostname}
      preview={visiblePreview}
      isShortVideo={isShortVideo}
      isTikTok={isTikTok}
      hltvImageScore={hltvImageScore}
      onPreviewError={onPreviewError}
    />
  );
}

export function FeedItemCardSupplementary({ model }: { model: FeedItemCardModel }) {
  const { item, isPreviewPending, isHltv, isTikTok, openGraphPreview } = model;
  return (
    <>
      {!isPreviewPending && isHltv && openGraphPreview?.matchStartsAt ? (
        <HltvCountdown startsAt={openGraphPreview.matchStartsAt} />
      ) : null}
      {!isPreviewPending && isTikTok ? <TikTokComments item={item} /> : null}
    </>
  );
}

export function FeedItemCardCopy({ model }: { model: FeedItemCardModel }) {
  const { t } = useTranslation();
  const {
    item,
    hostname,
    isPreviewPending,
    isImagePreviewOnly,
    isYoutube,
    isShortVideo,
    isSimpleImageCard,
    description,
  } = model;

  if (isPreviewPending || isImagePreviewOnly || isShortVideo) return null;
  if (isYoutube) {
    return (
      <div className="reader-card__youtube-copy">
        <h2 className="reader-card__title">{item.text || item.title}</h2>
        <p className="reader-card__channel">{getYoutubeChannelName(item.title)}</p>
      </div>
    );
  }
  if (isSimpleImageCard) {
    return <h2 className="reader-card__title">{item.title || hostname}</h2>;
  }

  return (
    <>
      <div className="reader-card__meta">
        <span>{hostname}</span>
        <span>{t('feed.item')} #{item.feedId}</span>
      </div>
      <h2 className="reader-card__title">{item.title || hostname}</h2>
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
