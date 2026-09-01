import type {
  OneFootballMatchSnapshot,
  OneFootballMatchTeamPreview,
} from '../../../../shared/previewContracts';

export function OneFootballMatch({
  href,
  snapshot,
}: {
  href: string;
  snapshot: OneFootballMatchSnapshot;
}) {
  const [homeTeam, awayTeam] = snapshot.teams;
  const score = snapshot.score;
  if (!score) return null;

  return (
    <a
      className="reader-card__onefootball-match"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`${homeTeam.name} ${score[0]}–${score[1]} ${awayTeam.name}`}
    >
      <OneFootballTeam team={homeTeam} side="home" />
      <span className="reader-card__onefootball-result">
        <strong>{score[0]} : {score[1]}</strong>
      </span>
      <OneFootballTeam team={awayTeam} side="away" />
    </a>
  );
}

function OneFootballTeam({
  team,
  side,
}: {
  team: OneFootballMatchTeamPreview;
  side: 'home' | 'away';
}) {
  return (
    <span className={`reader-card__onefootball-team reader-card__onefootball-team--${side}`}>
      {team.logo ? <img src={team.logo} alt="" /> : null}
      <strong>{team.name}</strong>
    </span>
  );
}
