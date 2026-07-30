import { useEffect, useState } from 'react';

import { useFeedItemRemotePreview } from '../hooks/useFeedItemRemotePreview';
import { useNsfwPreferences } from '../state/useNsfwPreferences';
import type { FeedItem } from '../types';
import {
  analyzeFeedItem,
  getRemoteFeedItemPreview,
  getTikTokEmbedPreview,
  isGenericHltvPreview,
  isRedditUrl,
  isRezkaUrl,
  type FeedItemPreview,
} from '../domain/feedItemPreview';
import { InstagramIcon } from './Icons';
import { isNsfwLink } from './nsfw';
import { LiquipediaMatch } from './previews/LiquipediaMatch';
import { HltvCountdown, HltvMatchup } from './previews/HltvMatch';
import { FeedItemMedia } from './previews/FeedItemMedia';
import { TikTokComments } from './previews/TikTokComments';
import { YoutubePreview } from './previews/YoutubePreview';

export function FeedItemCard({ item }: { item: FeedItem }) {
  const { nsfwMode } = useNsfwPreferences();
  const analysis = analyzeFeedItem(item);
  const { hostname, url: itemUrl, provider, localPreview, youtubeVideoId } = analysis;
  const isNsfw = isNsfwLink(item.link);
  const shouldBlurNsfw = isNsfw && nsfwMode === 'blur';
  const shouldHideNsfw = isNsfw && nsfwMode === 'hide';
  const localPreviewSource = localPreview?.src;
  const isYoutube = provider === 'youtube';
  const isTikTok = provider === 'tiktok';
  const isInstagram = provider === 'instagram';
  const isShortVideo = isTikTok || isInstagram;
  const isReddit = isRedditUrl(itemUrl);
  const isRezka = isRezkaUrl(itemUrl);
  const isVk = provider === 'vk';
  const isHltv = provider === 'hltv';
  const isLiquipedia = provider === 'liquipedia';
  const feedDescription = isVk ? getFeedItemDescription(item.text, item.title) : null;
  const shouldLoadRemotePreview = !shouldHideNsfw
    && !isTikTok
    && (isRezka || !(localPreviewSource && (!isVk || feedDescription)));
  const {
    cardRef,
    openGraphPreview,
    liquipediaMatch,
    previewStatus,
  } = useFeedItemRemotePreview(
    item.link,
    shouldLoadRemotePreview,
    isLiquipedia,
    isHltv,
  );
  const loadedRemotePreview = getRemoteFeedItemPreview(openGraphPreview, item.title);
  const remotePreview = isRezka && loadedRemotePreview && localPreviewSource
    ? { ...loadedRemotePreview, fallbackSrc: localPreviewSource }
    : loadedRemotePreview;
  const description = isVk
    ? feedDescription ??
      getFeedItemDescription(openGraphPreview?.description ?? '', item.title)
    : null;
  const tiktokEmbedPreview = isTikTok ? getTikTokEmbedPreview(item) : null;
  const preview = isTikTok
    ? tiktokEmbedPreview ?? localPreview
    : isRezka
      ? remotePreview ?? localPreview
      : localPreview ?? remotePreview;
  const [previewFailures, setPreviewFailures] = useState(0);
  const fallbackSource = preview && 'fallbackSrc' in preview && typeof preview.fallbackSrc === 'string'
    ? preview.fallbackSrc
    : null;
  const fallbackPreview: FeedItemPreview | null = preview && fallbackSource
    ? { src: fallbackSource, alt: preview.alt }
    : null;
  const visiblePreview = liquipediaMatch ? null : previewFailures === 1 && preview?.type === 'video'
    ? tiktokEmbedPreview ?? (preview.poster ? { src: preview.poster, alt: preview.alt } : null)
    : previewFailures === 1 && fallbackPreview
      ? fallbackPreview
    : previewFailures > 0 ? null : preview;
  const isInstagramPhoto = isInstagram && visiblePreview?.type === undefined;
  const isSimpleImageCard = provider === 'generic'
    && Boolean(visiblePreview && visiblePreview.type === undefined);
  const isImagePreviewOnly = Boolean(
    visiblePreview &&
    visiblePreview.type === undefined &&
    (
      visiblePreview.src.startsWith('/api/bff/reddit-preview-image?') ||
      (isHltv && visiblePreview.src === remotePreview?.src)
    ),
  );
  const hltvMatchTeams = isHltv
    && visiblePreview
    && visiblePreview.type === undefined
    && (
      isGenericHltvPreview(visiblePreview.src)
      || openGraphPreview?.matchStatus === 'live'
    )
    ? openGraphPreview?.matchTeams
    : null;
  const hltvImageScore = isHltv
    && !hltvMatchTeams
    && openGraphPreview?.matchStatus === 'over'
    ? openGraphPreview.matchScore ?? null
    : null;
  const isPreviewPending = shouldLoadRemotePreview
    && !localPreview
    && previewStatus === 'pending';

  useEffect(() => {
    setPreviewFailures(0);
  }, [item.link]);

  if (shouldHideNsfw) return null;

  return (
    <article
      ref={cardRef}
      className={[
        'reader-card',
        isPreviewPending ? 'reader-card--preview-pending' : '',
        isLiquipedia ? 'reader-card--liquipedia' : '',
        isYoutube ? 'reader-card--youtube' : '',
        isShortVideo ? 'reader-card--short-video' : '',
        isTikTok ? 'reader-card--tiktok' : '',
        isInstagram ? 'reader-card--instagram' : '',
        isInstagramPhoto ? 'reader-card--instagram-photo' : '',
        isSimpleImageCard ? 'reader-card--simple-image' : '',
        isImagePreviewOnly ? 'reader-card--image-preview' : '',
        isImagePreviewOnly && isReddit ? 'reader-card--reddit-preview' : '',
        isImagePreviewOnly && isHltv ? 'reader-card--hltv-preview' : '',
        shouldBlurNsfw ? 'reader-card--nsfw-blurred' : '',
      ].filter(Boolean).join(' ')}
      inert={shouldBlurNsfw}
    >
      {shouldBlurNsfw ? (
        <div className="reader-card__nsfw-shield" aria-hidden="true">
          <strong>NSFW</strong>
          <span>Hidden by settings</span>
        </div>
      ) : null}
      {isInstagram ? (
        <div className="reader-card__short-video-identity">
          <span className="reader-card__short-video-logo"><InstagramIcon /></span>
          <span>{getInstagramUsername(item.title)}</span>
        </div>
      ) : null}
      {isPreviewPending ? (
        <div className="reader-card__preview-placeholder" role="status" aria-label="Loading preview" />
      ) : hltvMatchTeams ? (
        <HltvMatchup
          teams={hltvMatchTeams}
          href={item.link}
          score={openGraphPreview?.matchScore}
          isLive={openGraphPreview?.matchStatus === 'live'}
          currentMap={openGraphPreview?.matchCurrentMap}
          completedMaps={openGraphPreview?.matchCompletedMaps}
          playerStats={openGraphPreview?.matchPlayerStats}
          teamSides={openGraphPreview?.matchTeamSides}
        />
      ) : isYoutube && youtubeVideoId ? (
        <YoutubePreview
          videoId={youtubeVideoId}
          title={item.text || item.title}
          preview={visiblePreview}
          onPreviewError={() => setPreviewFailures((failures) => failures + 1)}
        />
      ) : liquipediaMatch ? (
        <LiquipediaMatch match={liquipediaMatch} />
      ) : visiblePreview ? (
        <FeedItemMedia
          href={item.link}
          hostname={item.title || hostname}
          preview={visiblePreview}
          isShortVideo={isShortVideo}
          isTikTok={isTikTok}
          hltvImageScore={hltvImageScore}
          onPreviewError={() => setPreviewFailures((failures) => failures + 1)}
        />
      ) : null}
      {!isPreviewPending && isHltv && openGraphPreview?.matchStartsAt ? (
        <HltvCountdown startsAt={openGraphPreview.matchStartsAt} />
      ) : null}
      {!isPreviewPending && isTikTok ? <TikTokComments item={item} /> : null}
      {isPreviewPending || isImagePreviewOnly ? null : isYoutube ? (
        <div className="reader-card__youtube-copy">
          <h2 className="reader-card__title">{item.text || item.title}</h2>
          <p className="reader-card__channel">{getYoutubeChannelName(item.title)}</p>
        </div>
      ) : isShortVideo ? null : isSimpleImageCard ? (
        <h2 className="reader-card__title">{item.title || hostname}</h2>
      ) : (
        <>
          <div className="reader-card__meta">
            <span>{hostname}</span>
            <span>Feed #{item.feedId}</span>
          </div>
          <h2 className="reader-card__title">{item.title || hostname}</h2>
          {description ? <p className="reader-card__description">{description}</p> : null}
          <a className="reader-card__link" href={item.link} target="_blank" rel="noreferrer">
            Read original <span aria-hidden="true">↗</span>
          </a>
        </>
      )}
    </article>
  );
}

function getFeedItemDescription(content: string, title: string): string | null {
  if (!content) return null;

  const document = new DOMParser().parseFromString(content, 'text/html');
  document.querySelectorAll('script, style, noscript').forEach((element) => element.remove());
  const description = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (!description || description.toLocaleLowerCase() === title.trim().toLocaleLowerCase()) return null;
  return description;
}

function getYoutubeChannelName(title: string): string {
  return title.replace(/^YT:\s*/i, '').trim() || 'YouTube';
}

function getInstagramUsername(title: string): string {
  return title.replace(/^inst:\s*/i, '').trim() || 'Instagram';
}
