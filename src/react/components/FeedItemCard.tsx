import { useEffect, useRef, useState } from 'react';

import {
  getLiquipediaMatchPreview,
  type LiquipediaMatchPreview,
  type LiquipediaMatchTeam,
} from '../services/liquipedia';
import { getOpenGraphPreview } from '../services/openGraph';
import type { FeedItem } from '../types';
import {
  getFeedItemPreview,
  getYoutubeVideoId,
  isHltvFeedItem,
  isLiquipediaFeedItem,
  isTikTokFeedItem,
  isVkFeedItem,
  isYoutubeFeedItem,
} from './feedItemPreview';

export function FeedItemCard({ item }: { item: FeedItem }) {
  const hostname = getHostname(item.link);
  const itemUrl = parseUrl(item.link);
  const youtubeVideoId = itemUrl ? getYoutubeVideoId(itemUrl) : null;
  const localPreview = getFeedItemPreview(item);
  const localPreviewSource = localPreview?.src;
  const [openGraphPreview, setOpenGraphPreview] = useState<Awaited<ReturnType<typeof getOpenGraphPreview>> | null>(null);
  const isYoutube = isYoutubeFeedItem(item);
  const isTikTok = isTikTokFeedItem(item);
  const isVk = isVkFeedItem(item);
  const isHltv = isHltvFeedItem(item);
  const isLiquipedia = isLiquipediaFeedItem(item);
  const [liquipediaMatch, setLiquipediaMatch] = useState<LiquipediaMatchPreview | null>(null);
  const remotePreview = getRemotePreview(openGraphPreview, item.title);
  const feedDescription = isVk ? getFeedItemDescription(item.text, item.title) : null;
  const description = isVk
    ? feedDescription ??
      getFeedItemDescription(openGraphPreview?.description ?? '', item.title)
    : null;
  const tiktokEmbedPreview = isTikTok ? getTikTokEmbedPreview(item) : null;
  const preview = isTikTok
    ? tiktokEmbedPreview ?? localPreview
    : localPreview ?? remotePreview;
  const [previewFailures, setPreviewFailures] = useState(0);
  const [isYoutubePlayerOpen, setIsYoutubePlayerOpen] = useState(false);
  const [isYoutubeTheaterOpen, setIsYoutubeTheaterOpen] = useState(false);
  const visiblePreview = liquipediaMatch ? null : previewFailures === 1 && preview?.type === 'video'
    ? tiktokEmbedPreview ?? (preview.poster ? { src: preview.poster, alt: preview.alt } : null)
    : previewFailures > 0 ? null : preview;
  const isImagePreviewOnly = Boolean(
    visiblePreview &&
    visiblePreview.type === undefined &&
    (
      visiblePreview.src.startsWith('/api/bff/reddit-preview-image?') ||
      (isHltv && visiblePreview.src === remotePreview?.src)
    ),
  );

  useEffect(() => {
    setOpenGraphPreview(null);
    setLiquipediaMatch(null);
    setPreviewFailures(0);
    setIsYoutubePlayerOpen(false);
    setIsYoutubeTheaterOpen(false);
    if (isTikTok || (localPreviewSource && (!isVk || feedDescription))) return;

    const controller = new AbortController();
    if (isLiquipedia) {
      getLiquipediaMatchPreview(item.link, controller.signal)
        .then(setLiquipediaMatch)
        .catch(() => getOpenGraphPreview(item.link, controller.signal)
          .then(setOpenGraphPreview)
          .catch(() => undefined));
    } else {
      getOpenGraphPreview(item.link, controller.signal)
        .then(setOpenGraphPreview)
        .catch(() => undefined);
    }

    return () => controller.abort();
  }, [feedDescription, isLiquipedia, isTikTok, isVk, item.link, localPreviewSource]);

  useEffect(() => {
    if (!isYoutubeTheaterOpen) return;

    document.documentElement.classList.add('reader-theater-open');

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsYoutubeTheaterOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.documentElement.classList.remove('reader-theater-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isYoutubeTheaterOpen]);

  return (
    <article
      className={[
        'reader-card',
        isLiquipedia ? 'reader-card--liquipedia' : '',
        isYoutube ? 'reader-card--youtube' : '',
        isTikTok ? 'reader-card--tiktok' : '',
        isImagePreviewOnly ? 'reader-card--image-preview' : '',
      ].filter(Boolean).join(' ')}
    >
      {isYoutube && !isYoutubePlayerOpen ? (
        <button
          type="button"
          className="reader-card__youtube-trigger"
          aria-label={`Play video ${item.text || item.title}`}
          onClick={() => setIsYoutubePlayerOpen(true)}
        />
      ) : null}
      {isYoutubePlayerOpen && youtubeVideoId ? (
        <YoutubePlayer
          videoId={youtubeVideoId}
          title={item.text || item.title}
          isTheaterOpen={isYoutubeTheaterOpen}
          onToggleTheater={() => setIsYoutubeTheaterOpen((isOpen) => !isOpen)}
        />
      ) : liquipediaMatch ? (
        <LiquipediaMatch match={liquipediaMatch} />
      ) : visiblePreview ? visiblePreview.type === 'video' ? (
        <div className={[
          'reader-card__preview',
          'reader-card__preview--video',
          isTikTok ? 'reader-card__preview--tiktok' : '',
        ].filter(Boolean).join(' ')}>
          <video
            key={visiblePreview.src}
            src={visiblePreview.src}
            poster={visiblePreview.poster}
            aria-label={visiblePreview.alt}
            autoPlay={isTikTok}
            controls
            loop={isTikTok}
            playsInline
            preload={isTikTok ? 'auto' : 'metadata'}
            onError={() => setPreviewFailures((failures) => failures + 1)}
          />
        </div>
      ) : visiblePreview.type === 'embed' ? (
        <TikTokEmbed src={visiblePreview.src} title={visiblePreview.alt} />
      ) : (
        isYoutube ? (
          <div className="reader-card__preview">
            <img
              src={visiblePreview.src}
              alt={visiblePreview.alt}
              referrerPolicy="no-referrer"
              onError={() => setPreviewFailures((failures) => failures + 1)}
            />
          </div>
        ) : <a
          className={[
            'reader-card__preview',
            isTikTok ? 'reader-card__preview--tiktok' : '',
          ].filter(Boolean).join(' ')}
          href={item.link}
          target="_blank"
          rel="noreferrer"
          aria-label={isYoutube ? `Open video ${item.text || item.title}` : `Open ${item.title || hostname}`}
        >
          <img
            src={visiblePreview.src}
            alt={visiblePreview.alt}
            referrerPolicy="no-referrer"
            onError={() => setPreviewFailures((failures) => failures + 1)}
          />
        </a>
      ) : null}
      {isImagePreviewOnly ? null : isYoutube ? (
        <div className="reader-card__youtube-copy">
          <h2 className="reader-card__title">{item.text || item.title}</h2>
          <p className="reader-card__channel">{getYoutubeChannelName(item.title)}</p>
        </div>
      ) : isTikTok ? null : (
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

type YoutubePlayerProps = {
  videoId: string;
  title: string;
  isTheaterOpen: boolean;
  onToggleTheater: () => void;
};

function YoutubePlayer({ videoId, title, isTheaterOpen, onToggleTheater }: YoutubePlayerProps) {
  const parameters = new URLSearchParams({ autoplay: '1', rel: '0' });

  return (
    <div className={[
      'reader-card__youtube-player-shell',
      isTheaterOpen ? 'reader-card__youtube-player-shell--theater' : '',
    ].filter(Boolean).join(' ')}>
      <div className="reader-card__youtube-player-stage">
        <div className="reader-card__youtube-player-toolbar">
          <button
            type="button"
            className="reader-card__theater-toggle"
            aria-label={isTheaterOpen ? 'Exit theater mode' : 'Enter theater mode'}
            aria-pressed={isTheaterOpen}
            onClick={onToggleTheater}
          >
            <span aria-hidden="true">{isTheaterOpen ? '↙' : '↗'}</span>
            {isTheaterOpen ? 'Exit theater' : 'Theater mode'}
          </button>
        </div>
        <div className="reader-card__preview reader-card__preview--youtube-player">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${parameters}`}
            title={title || 'YouTube video player'}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </div>
  );
}

function LiquipediaMatch({ match }: { match: LiquipediaMatchPreview }) {
  const [firstTeam, secondTeam] = match.teams;
  const [firstScore, secondScore] = match.score;

  return (
    <section
      className="liquipedia-match"
      aria-label={`${firstTeam.name} ${firstScore} to ${secondScore} ${secondTeam.name}`}
    >
      <time className="liquipedia-match__date">{match.date}</time>
      <div className="liquipedia-match__overview">
        <LiquipediaTeam team={firstTeam} />
        <div className="liquipedia-match__result">
          <strong>
            <span>{firstScore}</span>
            <span aria-hidden="true">:</span>
            <span>{secondScore}</span>
          </strong>
          <span>{match.status}</span>
        </div>
        <LiquipediaTeam team={secondTeam} reverse />
      </div>
      <p className="liquipedia-match__tournament">{match.tournament}</p>
    </section>
  );
}

function LiquipediaTeam({ team, reverse = false }: { team: LiquipediaMatchTeam; reverse?: boolean }) {
  return (
    <div className={reverse ? 'liquipedia-team liquipedia-team--reverse' : 'liquipedia-team'}>
      <div className="liquipedia-team__identity">
        <strong title={team.name}>{team.name}</strong>
        {team.logo ? (
          <img src={team.logo} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="liquipedia-team__monogram" aria-hidden="true">
            {team.shortName.slice(0, 2)}
          </span>
        )}
      </div>
      {team.results.length > 0 ? (
        <div className="liquipedia-team__form" aria-label={`${team.name} game results`}>
          {team.results.map((result, index) => (
            <span
              key={`${result}-${index}`}
              className={`liquipedia-team__form-result liquipedia-team__form-result--${result}`}
              aria-label={result === 'default' ? 'No result' : result}
            >
              {result === 'win' ? 'W' : result === 'loss' ? 'L' : '–'}
            </span>
          ))}
        </div>
      ) : null}
    </div>
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

type CardPreview = {
  src: string;
  alt: string;
  type?: 'video' | 'embed';
  poster?: string;
};

function TikTokEmbed({ src, title }: { src: string; title: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const playWhenReady = (event: MessageEvent) => {
      const playerWindow = frameRef.current?.contentWindow;
      if (event.origin !== 'https://www.tiktok.com' ||
        !playerWindow ||
        event.source !== playerWindow ||
        !isTikTokPlayerReadyMessage(event.data)) return;

      playerWindow.postMessage({ type: 'unMute', 'x-tiktok-player': true }, event.origin);
      playerWindow.postMessage({ type: 'play', 'x-tiktok-player': true }, event.origin);
    };
    window.addEventListener('message', playWhenReady);
    return () => window.removeEventListener('message', playWhenReady);
  }, []);

  return (
    <div className="reader-card__preview reader-card__preview--tiktok">
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        allow="autoplay; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

function isTikTokPlayerReadyMessage(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message['x-tiktok-player'] === true && message.type === 'onPlayerReady';
}

function getTikTokEmbedPreview(item: FeedItem): CardPreview | null {
  const url = parseUrl(item.link);
  const videoId = url?.pathname.match(/\/video\/(\d+)/)?.[1];
  if (!videoId) return null;

  const parameters = new URLSearchParams({
    autoplay: '1',
    muted: '0',
    loop: '1',
    controls: '1',
    music_info: '0',
    description: '0',
    rel: '0',
  });
  return {
    src: `https://www.tiktok.com/player/v1/${videoId}?${parameters}`,
    alt: item.title ? `Video preview for ${item.title}` : 'TikTok video preview',
    type: 'embed',
  };
}

function getRemotePreview(
  preview: Awaited<ReturnType<typeof getOpenGraphPreview>> | null,
  title: string,
): CardPreview | null {
  if (!preview) return null;
  const altTitle = preview.title || title;

  if (preview.video && isDirectVideo(preview.video)) {
    return {
      src: preview.video,
      alt: altTitle ? `Video preview for ${altTitle}` : 'Feed item video preview',
      type: 'video',
      ...(preview.image ? { poster: preview.image } : {}),
    };
  }

  return preview.image ? {
    src: preview.image,
    alt: altTitle ? `Preview for ${altTitle}` : 'Feed item preview',
  } : null;
}

function isDirectVideo(value: string): boolean {
  return /\.(?:m4v|mov|mp4|webm)(?:$|[?#])/i.test(value);
}

function getYoutubeChannelName(title: string): string {
  return title.replace(/^YT:\s*/i, '').trim() || 'YouTube';
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getHostname(link: string): string {
  return parseUrl(link)?.hostname.replace(/^www\./, '') || 'Feed item';
}
