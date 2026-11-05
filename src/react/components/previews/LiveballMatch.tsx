import type { FeedItem } from '../../types';
import type { parseLiveballMatch } from '../../domain/liveballMatch';

export function LiveballMatch({ item, match }: { item: FeedItem; match: NonNullable<ReturnType<typeof parseLiveballMatch>> }) {
  return (
    <a className="reader-card__onefootball-match reader-card__liveball-match" href={item.link} target="_blank" rel="noreferrer">
      {match.competition && <span className="reader-card__onefootball-competition"><strong>{match.competition}</strong></span>}
      <span className="reader-card__onefootball-matchup">
        <span className="reader-card__onefootball-logo reader-card__onefootball-logo--team reader-card__onefootball-logo--home" aria-hidden="true">⚽</span>
        <span className="reader-card__onefootball-result"><strong>VS</strong></span>
        <span className="reader-card__onefootball-logo reader-card__onefootball-logo--team reader-card__onefootball-logo--away" aria-hidden="true">⚽</span>
        <strong className="reader-card__onefootball-team-name reader-card__onefootball-team-name--home">{match.home}</strong>
        <strong className="reader-card__onefootball-team-name reader-card__onefootball-team-name--away">{match.away}</strong>
      </span>
    </a>
  );
}
