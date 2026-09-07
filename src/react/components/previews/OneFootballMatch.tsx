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
  const [homeTeam, awayTeam] = snapshot.teams;
  const score = snapshot.score;
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
      <OneFootballTeam team={homeTeam} side="home" />
      <span className="reader-card__onefootball-result">
        <strong>{score ? `${score[0]} : ${score[1]}` : '–'}</strong>
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
      {team.goals?.length ? (
        <span className="reader-card__onefootball-goals">
          {team.goals.map((goal, index) => (
            <span className="reader-card__onefootball-goal" key={`${goal.scorer}-${goal.minute}-${index}`}>
              <span>{goal.scorer}{goal.label ? ` (${goal.label})` : ''}</span>
              <span className="reader-card__onefootball-minute">{goal.minute}</span>
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
