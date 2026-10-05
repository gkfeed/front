import type { HltvMatchSnapshot } from '../../../../shared/previewContracts';
import { useTranslation } from 'react-i18next';

import { getHltvMapScoreClass } from './hltvPresentation';
import { getHltvMapImage } from './hltvMapImages';

export function HltvMatchupScore({
  score,
  isLive,
  currentMap,
  completedMaps,
  teamSides,
}: {
  score: HltvMatchSnapshot['score'];
  isLive: boolean;
  currentMap: HltvMatchSnapshot['currentMap'];
  completedMaps: NonNullable<HltvMatchSnapshot['completedMaps']>;
  teamSides: HltvMatchSnapshot['teamSides'];
}) {
  const { t } = useTranslation();

  if (!score) return <strong className="reader-card__hltv-versus">{t('hltv.versus')}</strong>;

  return (
    <span
      className={[
        'reader-card__hltv-score',
        isLive ? 'reader-card__hltv-score--live' : '',
      ].filter(Boolean).join(' ')}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="reader-card__hltv-series-score">
        {isLive ? (
          <span className="reader-card__hltv-live-label">
            <i aria-hidden="true" /> {t('hltv.live')}
          </span>
        ) : null}
        <strong>{score[0]} : {score[1]}</strong>
      </span>
      {completedMaps.length > 0 || (isLive && currentMap) ? (
        <span className="reader-card__hltv-maps">
          {completedMaps.map((map) => (
            <HltvMapCard key={map.name} map={map} teamSides={null} />
          ))}
          {isLive && currentMap ? (
            <HltvMapCard map={currentMap} teamSides={teamSides} isCurrent />
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function HltvMapCard({
  map,
  teamSides,
  isCurrent = false,
}: {
  map: NonNullable<HltvMatchSnapshot['currentMap']>;
  teamSides: HltvMatchSnapshot['teamSides'];
  isCurrent?: boolean;
}) {
  const image = getHltvMapImage(map.name);

  return (
    <span className={[
      'reader-card__hltv-map-card',
      isCurrent ? 'reader-card__hltv-current-map' : 'reader-card__hltv-completed-map',
    ].join(' ')}>
      {image ? <img className="reader-card__hltv-map-image" src={image} alt="" loading="lazy" /> : null}
      <b>{map.name}</b>
      <HltvMapScore score={map.score} teamSides={teamSides} />
    </span>
  );
}

function HltvMapScore({
  score,
  teamSides,
}: {
  score: [string, string];
  teamSides: HltvMatchSnapshot['teamSides'];
}) {
  return (
    <span className="reader-card__hltv-current-map-score">
      <span className={getHltvMapScoreClass(score, 0, teamSides)}>{score[0]}</span>
      <i aria-hidden="true">:</i>
      <span className={getHltvMapScoreClass(score, 1, teamSides)}>{score[1]}</span>
    </span>
  );
}
