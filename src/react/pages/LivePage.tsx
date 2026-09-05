import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../../styles/live.css';
import '../../styles/reader.css';
import { useLivePageModel } from '../adapters/live/useLivePageModel';
import { liveProviderRegistry } from '../components/live/liveProviderRegistry';

const COLLAPSED_EVENT_COUNT = 6;

export function LivePage() {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const model = useLivePageModel(t, liveProviderRegistry);
  const adapters = useMemo(
    () => new Map(model.adapters.map((adapter) => [adapter.id, adapter])),
    [model.adapters],
  );
  const visibleSections = model.sections.filter((section) => (
    section.events.length > 0 || section.state !== 'healthy'
  ));
  const showSearch = !model.scanComplete && !model.hasFreshEvents;
  const showEmpty = model.scanComplete
    && model.sections.every((section) => section.events.length === 0 && section.state === 'healthy');

  return (
    <section className="live" aria-labelledby="live-page-title">
      <h1 id="live-page-title" className="sr-only">{t('pages.live')}</h1>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {model.hasFreshEvents ? t('live.resultsUpdated') : showSearch ? t('live.searching') : ''}
      </p>

      {visibleSections.map((section) => {
        const isExpanded = expanded[section.category.id] ?? false;
        const visibleEvents = isExpanded
          ? section.events
          : section.events.slice(0, COLLAPSED_EVENT_COUNT);
        return (
          <section className="live-section" key={section.category.id} aria-labelledby={`live-${section.category.id}`}>
            <div className="live-section__heading">
              <h2 id={`live-${section.category.id}`}>{t(section.category.titleKey)}</h2>
              {section.state === 'warning' ? <span role="status">{t('live.partialWarning')}</span> : null}
            </div>
            {section.state === 'loading' && section.events.length === 0 ? (
              <div className={`live-section__items live-section__items--${section.category.layout}`} aria-label={t('live.loadingCategory')}>
                {Array.from({ length: 3 }, (_, index) => <div className="live-event-skeleton" key={index} />)}
              </div>
            ) : null}
            {section.state === 'error' && section.events.length === 0 ? (
              <div className="live-section__error" role="alert">
                <span>{t('live.providerError')}</span>
                <button type="button" className="ui-button--secondary" onClick={model.refresh}>{t('live.tryAgain')}</button>
              </div>
            ) : null}
            {visibleEvents.length > 0 ? (
              <div className={`live-section__items live-section__items--${section.category.layout}`}>
                {visibleEvents.map((event) => {
                  const adapter = adapters.get(event.candidate.providerId);
                  return adapter ? (
                    <div key={event.candidate.key}>
                      {adapter.render({
                        event,
                        t,
                        onPlaybackChange: (isOpen) => model.onPlaybackChange(event.candidate.key, isOpen),
                      })}
                    </div>
                  ) : null;
                })}
              </div>
            ) : null}
            {section.events.length > COLLAPSED_EVENT_COUNT ? (
              <button
                type="button"
                className="live-section__expand ui-button--secondary"
                aria-expanded={isExpanded}
                onClick={() => setExpanded((current) => ({ ...current, [section.category.id]: !isExpanded }))}
              >
                {isExpanded ? t('live.showLess') : t('live.showAll', { count: section.events.length })}
              </button>
            ) : null}
          </section>
        );
      })}

      {showSearch ? (
        <div className="live__state" role="status">
          <span className="live__spinner" aria-hidden="true" />
          <p>{t('live.searching')}</p>
        </div>
      ) : null}

      {showEmpty ? (
        <div className="live__state">
          <h2>{t('live.noEvents')}</h2>
          <p>{t('live.noEventsText')}</p>
        </div>
      ) : null}

      <div className="live__status-row" role="status">
        <span>{model.scanComplete
          ? t('live.indexComplete', { count: model.scannedItems })
          : t('live.indexing', { count: model.scannedItems })}</span>
        {model.lastSuccessfulAt ? (
          <span>{t('live.lastUpdated', {
            time: new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' })
              .format(model.lastSuccessfulAt),
          })}</span>
        ) : null}
        {model.scanError ? <span className="live__warning">{model.scanError}</span> : null}
        <button
          type="button"
          className="ui-button--secondary"
          disabled={model.refreshing}
          onClick={model.refresh}
        >
          {model.refreshing ? t('live.refreshing') : t('live.refresh')}
        </button>
      </div>
    </section>
  );
}
