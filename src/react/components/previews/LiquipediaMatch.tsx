import type {
  LiquipediaMatchPreview,
  LiquipediaMatchTeam,
} from '../../../../shared/previewContracts';
import { useTranslation } from 'react-i18next';

export function LiquipediaMatch({ match }: { match: LiquipediaMatchPreview }) {
  const { t } = useTranslation();
  const [firstTeam, secondTeam] = match.teams;
  const [firstScore, secondScore] = match.score;

  return (
    <section
      className="liquipedia-match"
      aria-label={t('liquipedia.match', {
        firstTeam: firstTeam.name,
        firstScore,
        secondScore,
        secondTeam: secondTeam.name,
      })}
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
  const { t } = useTranslation();
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
        <div className="liquipedia-team__form" aria-label={t('liquipedia.gameResults', { team: team.name })}>
          {team.results.map((result, index) => (
            <span
              key={`${result}-${index}`}
              className={`liquipedia-team__form-result liquipedia-team__form-result--${result}`}
              aria-label={result === 'default' ? t('liquipedia.noResult') : result}
            >
              {result === 'win' ? 'W' : result === 'loss' ? 'L' : '–'}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
