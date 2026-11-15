import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FeedItem } from '../../types';
import type { parseLiveballMatch } from '../../domain/liveballMatch';
import type { OneFootballMatchSnapshot } from '../../../../shared/previewContracts';
import { formatHltvCountdown } from './hltvPresentation';

export function LiveballMatch({ item, match, snapshot = null }: {
  item: FeedItem;
  match: NonNullable<ReturnType<typeof parseLiveballMatch>>;
  snapshot?: OneFootballMatchSnapshot | null;
}) {
  const { i18n } = useTranslation();
  const scheduled = snapshot?.normalizedStatus === 'scheduled'
    || /^до\s*матча\s*:/iu.test(snapshot?.status ?? '');
  const teams = snapshot?.teams ?? [{ name: match.home, logo: null }, { name: match.away, logo: null }];
  const date = snapshot?.startsAt && !Number.isNaN(Date.parse(snapshot.startsAt))
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(snapshot.startsAt)) : null;
  return (
    <a className="liveball-match" href={item.link} target="_blank" rel="noreferrer">
      <span className="liveball-match__header">
        <span className="liveball-match__competition">{snapshot?.competition || match.competition}</span>
        <img className="liveball-match__brand" src="/liveball-logo.png" alt="LiveBall" />
      </span>
      <span className="liveball-match__teams">
        {teams.map((team, index) => (
          <span className="liveball-match__team" key={index}>
            <TeamCrest name={team.name} logo={team.logo} />
            <strong>{team.name}</strong>
          </span>
        ))}
        <span className="liveball-match__result">
          {date && <span className="liveball-match__date">{date}</span>}
          <strong>{!scheduled && snapshot?.score ? `${snapshot.score[0]} : ${snapshot.score[1]}` : 'VS'}</strong>
          {scheduled && snapshot?.startsAt ? <LiveballCountdown startsAt={snapshot.startsAt} /> : null}
          {!scheduled && snapshot?.status ? <span>{snapshot.status}</span> : null}
        </span>
      </span>
    </a>
  );
}

function TeamCrest({ name, logo }: { name: string; logo: string | null }) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  return <span className="liveball-match__crest">{logo && logo !== failedLogo
    ? <img src={logo} alt="" onError={() => setFailedLogo(logo)} />
    : <span aria-hidden="true">{name.slice(0, 1)}</span>}</span>;
}

function LiveballCountdown({ startsAt }: { startsAt: string }) {
  const { t } = useTranslation();
  const start = Date.parse(startsAt);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    setNow(Date.now());
    if (!Number.isFinite(start) || start <= Date.now()) return;
    const interval = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= start) window.clearInterval(interval);
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [start]);

  const remaining = start - now;
  if (!Number.isFinite(start) || remaining <= 0) return null;
  return <span className="liveball-match__countdown">{t('hltv.startsIn')} {formatHltvCountdown(remaining)}</span>;
}
