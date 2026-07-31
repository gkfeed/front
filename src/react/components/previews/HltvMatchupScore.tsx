import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import { useTranslation } from 'react-i18next';

import { getHltvMapScoreClass } from './hltvPresentation';

export function HltvMatchupScore({
  score,
  isLive,
  currentMap,
  completedMaps,
  teamSides,
}: {
  score: OpenGraphPreview['matchScore'];
  isLive: boolean;
  currentMap: OpenGraphPreview['matchCurrentMap'];
  completedMaps: NonNullable<OpenGraphPreview['matchCompletedMaps']>;
  teamSides: OpenGraphPreview['matchTeamSides'];
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
      {isLive ? (
        <span className="reader-card__hltv-live-label">
          <i aria-hidden="true" /> {t('hltv.live')}
        </span>
      ) : null}
      <strong>{score[0]} : {score[1]}</strong>
      {completedMaps.map((map) => (
        <span className="reader-card__hltv-completed-map" key={map.name}>
          <b>{map.name}</b>
          <HltvMapScore score={map.score} teamSides={null} />
        </span>
      ))}
      {isLive && currentMap ? (
        <span className="reader-card__hltv-current-map">
          <b>{currentMap.name}</b>
          <HltvMapScore score={currentMap.score} teamSides={teamSides} />
        </span>
      ) : null}
    </span>
  );
}

function HltvMapScore({
  score,
  teamSides,
}: {
  score: [string, string];
  teamSides: OpenGraphPreview['matchTeamSides'];
}) {
  return (
    <span className="reader-card__hltv-current-map-score">
      <span className={getHltvMapScoreClass(score, 0, teamSides)}>{score[0]}</span>
      <i aria-hidden="true">:</i>
      <span className={getHltvMapScoreClass(score, 1, teamSides)}>{score[1]}</span>
    </span>
  );
}
