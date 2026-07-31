import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { HltvMatchSnapshot } from '../../../../shared/previewContracts';
import { formatHltvCountdown } from './hltvPresentation';

export function HltvImageScore({
  score,
}: {
  score: NonNullable<HltvMatchSnapshot['score']>;
}) {
  return (
    <span className="reader-card__hltv-image-score" aria-hidden="true">
      {score[0]} : {score[1]}
    </span>
  );
}

export function HltvCountdown({ startsAt }: { startsAt: string }) {
  const { i18n, t } = useTranslation();
  const startTimestamp = Date.parse(startsAt);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!Number.isFinite(startTimestamp) || startTimestamp <= Date.now()) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [startTimestamp]);

  const remainingMilliseconds = startTimestamp - now;
  if (!Number.isFinite(startTimestamp) || remainingMilliseconds <= 0) return null;

  return (
    <time
      className="reader-card__hltv-countdown"
      dateTime={startsAt}
      title={new Date(startTimestamp).toLocaleString(i18n.language)}
      aria-live="polite"
    >
      {t('hltv.startsIn')} {formatHltvCountdown(remainingMilliseconds)}
    </time>
  );
}
