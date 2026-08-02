import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TwitchTitle } from '../components/TwitchTitle';
import { getFeedItemPreview } from '../domain/feedItemPreview';
import {
  getTwitchChannel as getTwitchChannelFromUrl,
  getTwitchStreamTitle,
} from '../domain/twitchPreview';
import { useAsyncLoad } from '../hooks/useAsyncLoad';
import { getLiveTwitchItems } from '../services/twitch';
import { getRequestErrorMessage } from '../services/authError';
import { useAuth } from '../state/useAuth';
import type { FeedItem } from '../types';

export function LivePage() {
  const { t } = useTranslation();
  const { credentials } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const load = useCallback((signal: AbortSignal) => getLiveTwitchItems(credentials, signal), [credentials]);
  const { result: items, status, error, isLoading, retry } = useAsyncLoad(load);
  const selectedItem = items?.find((item) => item.id === selectedId) ?? items?.[0];

  function selectChannel(id: number) {
    setSelectedId(id);
    setPlayingId(null);
  }

  return (
    <section className="live" aria-labelledby="live-page-title">
      <h1 id="live-page-title" className="sr-only">{t('pages.live')}</h1>

      {isLoading ? (
        <div className="live__status" role="status">
          <span className="live__spinner" aria-hidden="true" />
          {t('live.checking')}
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="live__state" role="alert">
          <h2>{t('live.checkErrorTitle')}</h2>
          <p>{getRequestErrorMessage(error, t, 'live.checkErrorText')}</p>
          <button type="button" className="secondary" onClick={retry}>{t('live.tryAgain')}</button>
        </div>
      ) : null}

      {!isLoading && items?.length === 0 ? (
        <div className="live__state">
          <h2>{t('live.noOne')}</h2>
          <p>{t('live.offline')}</p>
          <button type="button" className="secondary" onClick={retry}>{t('live.checkAgain')}</button>
        </div>
      ) : null}

      {items?.length && selectedItem ? (
        <div className="live__layout">
          <div className="live__stream-card">
            <TwitchPreview
              item={selectedItem}
              isPlaying={playingId === selectedItem.id}
              onPlay={() => setPlayingId(selectedItem.id)}
            />
            <div className="live__stream-copy">
              <h2 className="live__stream-title">
                <TwitchTitle
                  text={getTwitchStreamTitle(selectedItem.title, getTwitchChannel(selectedItem))}
                />
              </h2>
            </div>
          </div>
          <div className="live__channels">
            <p className="sr-only" role="status">
              {t('live.stream', { count: items.length })}
            </p>
            <ul aria-label={t('live.channels')}>
              {items.map((item) => {
                const channel = getTwitchChannel(item);
                const selected = item.id === selectedItem.id;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectChannel(item.id)}
                    >
                      <span className="live__channel-dot" aria-hidden="true" />
                      <span>{channel}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type TwitchPreviewProps = {
  item: FeedItem;
  isPlaying: boolean;
  onPlay: () => void;
};

function TwitchPreview({ item, isPlaying, onPlay }: TwitchPreviewProps) {
  const { t } = useTranslation();
  const channel = getTwitchChannel(item);
  const preview = getFeedItemPreview(item);

  if (isPlaying) {
    const parameters = new URLSearchParams({
      channel,
      parent: window.location.hostname || 'localhost',
      autoplay: 'true',
    });

    return (
      <div className="live__preview live__preview--player">
        <iframe
          src={`https://player.twitch.tv/?${parameters}`}
          title={t('live.playerTitle', { channel })}
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="live__preview live__preview-trigger"
      aria-label={t('live.playOn', { channel })}
      onClick={onPlay}
    >
      {preview ? <img src={preview.src} alt={t('live.previewAlt', { channel })} /> : null}
      <span className="live__play" aria-hidden="true">▶</span>
    </button>
  );
}

function getTwitchChannel(item: FeedItem): string {
  try {
    return getTwitchChannelFromUrl(new URL(item.link)) ?? item.title;
  } catch {
    return item.title;
  }
}
