import { useTranslation } from 'react-i18next';

import '../../styles/live.css';
import { LiveStreamPreview } from '../components/LiveStreamPreview';
import { TwitchTitle } from '../components/TwitchTitle';
import { useLivePageModel } from '../adapters/live/useLivePageModel';

export function LivePage() {
  const { t } = useTranslation();
  const {
    streams,
    selectedStream,
    playingId,
    status,
    errorMessage,
    isLoading,
    retry,
    selectChannel,
    playChannel,
  } = useLivePageModel(t);

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
          <p>{errorMessage}</p>
          <button type="button" className="ui-button--secondary" onClick={retry}>{t('live.tryAgain')}</button>
        </div>
      ) : null}

      {!isLoading && streams?.length === 0 ? (
        <div className="live__state">
          <h2>{t('live.noOne')}</h2>
          <p>{t('live.offline')}</p>
          <button type="button" className="ui-button--secondary" onClick={retry}>{t('live.checkAgain')}</button>
        </div>
      ) : null}

      {streams?.length && selectedStream ? (
        <div className="live__layout">
          <div className="live__stream-card">
            <LiveStreamPreview
              stream={selectedStream}
              isPlaying={playingId === selectedStream.item.id}
              onPlay={() => playChannel(selectedStream.item)}
            />
            <div className="live__stream-copy">
              <h2 className="live__stream-title">
                <TwitchTitle text={selectedStream.title} />
              </h2>
            </div>
          </div>
          <div className="live__channels">
            <p className="sr-only" role="status">
              {t('live.stream', { count: streams.length })}
            </p>
            <ul aria-label={t('live.channels')}>
              {streams.map((stream) => {
                const selected = stream.item.id === selectedStream.item.id;

                return (
                  <li key={stream.item.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectChannel(stream.item.id)}
                    >
                      <span className="live__channel-dot" aria-hidden="true" />
                      <span>{stream.channel}</span>
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
