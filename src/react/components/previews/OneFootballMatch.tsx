import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type {
  OneFootballMatchSnapshot,
  OneFootballMatchTeamPreview,
} from '../../../../shared/previewContracts';

export function OneFootballMatch({
  href,
  snapshot,
  externalLinkHint,
}: {
  href: string;
  snapshot: OneFootballMatchSnapshot;
  externalLinkHint?: string;
}) {
  const { t, i18n } = useTranslation();
  const [homeTeam, awayTeam] = snapshot.teams;
  const score = snapshot.score;
  const center = getMatchCenter(snapshot, i18n.language, t);
  const showGoals = snapshot.normalizedStatus === 'live' || snapshot.normalizedStatus === 'over';
  const label = score
    ? `${homeTeam.name} ${score[0]}–${score[1]} ${awayTeam.name}`
    : `${homeTeam.name} / ${awayTeam.name}`;

  return (
    <a
      className="reader-card__onefootball-match"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={externalLinkHint ? `${label}, ${externalLinkHint}` : label}
    >
      {snapshot.competition || snapshot.competitionLogo ? (
        <span className="reader-card__onefootball-competition">
          <MatchLogo key={snapshot.competitionLogo ?? 'competition'} src={snapshot.competitionLogo} size="competition" />
          {snapshot.competition ? <strong>{snapshot.competition}</strong> : null}
        </span>
      ) : null}

      <span className="reader-card__onefootball-matchup">
        <MatchLogo key={homeTeam.logo ?? 'home'} src={homeTeam.logo} size="team" side="home" />
        <span className={`reader-card__onefootball-result reader-card__onefootball-result--${snapshot.normalizedStatus ?? 'unknown'}`}>
          {center.top ? <span>{center.top}</span> : null}
          <strong>{center.main}</strong>
        </span>
        <MatchLogo key={awayTeam.logo ?? 'away'} src={awayTeam.logo} size="team" side="away" />
        <strong className="reader-card__onefootball-team-name reader-card__onefootball-team-name--home">
          {homeTeam.name}
        </strong>
        <strong className="reader-card__onefootball-team-name reader-card__onefootball-team-name--away">
          {awayTeam.name}
        </strong>
      </span>

      {showGoals && (homeTeam.goals?.length || awayTeam.goals?.length) ? (
        <span className="reader-card__onefootball-goals-grid">
          <OneFootballGoals team={homeTeam} />
          <OneFootballGoals team={awayTeam} />
        </span>
      ) : null}
    </a>
  );
}

function MatchLogo({
  src,
  size,
  side,
}: {
  src: string | null;
  size: 'competition' | 'team';
  side?: 'home' | 'away';
}) {
  const [failed, setFailed] = useState(false);
  const sideClass = side ? ` reader-card__onefootball-logo--${side}` : '';
  return (
    <span className={`reader-card__onefootball-logo reader-card__onefootball-logo--${size}${sideClass}`}>
      {src && !failed ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 28">
          <path d="M12 1.5 22 5.3v7.4c0 6.3-3.8 11-10 13.8C5.8 23.7 2 19 2 12.7V5.3L12 1.5Z" />
        </svg>
      )}
    </span>
  );
}

function OneFootballGoals({ team }: { team: OneFootballMatchTeamPreview }) {
  return (
    <span className="reader-card__onefootball-goals">
      {team.goals?.map((goal, index) => (
        <span className="reader-card__onefootball-goal" key={`${goal.scorer}-${goal.minute}-${index}`}>
          <span>{goal.scorer}{goal.label ? ` (${goal.label})` : ''}</span>
          <span className="reader-card__onefootball-minute">{goal.minute}</span>
        </span>
      ))}
    </span>
  );
}

function getMatchCenter(
  snapshot: OneFootballMatchSnapshot,
  language: string,
  t: TFunction,
): { top: string | null; main: string } {
  const kickoff = formatKickoff(snapshot.startsAt, language);
  const score = snapshot.score ? `${snapshot.score[0]} : ${snapshot.score[1]}` : '–';

  switch (snapshot.normalizedStatus) {
    case 'scheduled':
      return kickoff
        ? { top: t('onefootball.kickoffAt', { time: kickoff.time }), main: kickoff.date }
        : { top: null, main: '–' };
    case 'live':
      return { top: getLiveMinute(snapshot.status) ?? t('onefootball.live'), main: score };
    case 'over':
      return { top: t('onefootball.fullTime'), main: score };
    case 'postponed':
      return {
        top: t('onefootball.postponed'),
        main: kickoff ? `${kickoff.date}, ${kickoff.time}` : '–',
      };
    case null:
      return kickoff
        ? { top: kickoff.time, main: kickoff.date }
        : { top: null, main: '–' };
  }
}

function formatKickoff(value: string | null, language: string): { date: string; time: string } | null {
  if (!value || Number.isNaN(Date.parse(value))) return null;
  const date = new Date(value);
  return {
    date: new Intl.DateTimeFormat(language, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat(language, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  };
}

function getLiveMinute(status: string | null): string | null {
  const value = status?.trim() ?? '';
  return /^\d{1,3}(?:\+\d{1,2})?['’]$/.test(value) ? value : null;
}
