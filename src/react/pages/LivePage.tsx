import { useCallback, useState } from 'react';

import { getFeedItemPreview } from '../components/feedItemPreview';
import { useAsyncLoad } from '../hooks/useAsyncLoad';
import { getLiveTwitchItems } from '../services/twitch';
import { useAuth } from '../state/useAuth';
import type { FeedItem } from '../types';

export function LivePage() {
  const { credentials } = useAuth();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const load = useCallback(() => getLiveTwitchItems(credentials), [credentials]);
  const { result: items, isLoading, retry } = useAsyncLoad(load);
  const selectedItem = items?.find((item) => item.id === selectedId) ?? items?.[0];

  function selectChannel(id: number) {
    setSelectedId(id);
    setPlayingId(null);
  }

  return (
    <section className="live" aria-labelledby="live-page-title">
      <h1 id="live-page-title" className="sr-only">Live</h1>

      {isLoading ? (
        <div className="live__status" role="status">
          <span className="live__spinner" aria-hidden="true" />
          Checking Twitch channels…
        </div>
      ) : null}

      {!isLoading && items === undefined ? (
        <div className="live__state" role="alert">
          <h2>Couldn’t check Twitch</h2>
          <p>The live status check failed. Try again in a moment.</p>
          <button type="button" className="secondary" onClick={retry}>Try again</button>
        </div>
      ) : null}

      {!isLoading && items?.length === 0 ? (
        <div className="live__state">
          <h2>No one is live</h2>
          <p>Your Twitch feeds are currently offline.</p>
          <button type="button" className="secondary" onClick={retry}>Check again</button>
        </div>
      ) : null}

      {items?.length && selectedItem ? (
        <div className="live__layout">
          <TwitchPreview
            item={selectedItem}
            isPlaying={playingId === selectedItem.id}
            onPlay={() => setPlayingId(selectedItem.id)}
          />
          <div className="live__channels">
            <p className="sr-only" role="status">
              {items.length} {items.length === 1 ? 'stream' : 'streams'} live
            </p>
            <ul aria-label="Live Twitch channels">
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
          title={`${channel} Twitch player`}
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
      aria-label={`Play ${channel} on Twitch`}
      onClick={onPlay}
    >
      {preview ? <img src={preview.src} alt={`${channel} live stream preview`} /> : null}
      <span className="live__play" aria-hidden="true">▶</span>
    </button>
  );
}

function getTwitchChannel(item: FeedItem): string {
  try {
    return new URL(item.link).pathname.split('/').filter(Boolean)[0] ?? item.title;
  } catch {
    return item.title;
  }
}
