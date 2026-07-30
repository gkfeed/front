import { useEffect, useState } from 'react';

import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import { formatHltvCountdown } from './hltvPresentation';

export function HltvImageScore({
  score,
}: {
  score: NonNullable<OpenGraphPreview['matchScore']>;
}) {
  return (
    <span className="reader-card__hltv-image-score" aria-hidden="true">
      {score[0]} : {score[1]}
    </span>
  );
}

export function HltvCountdown({ startsAt }: { startsAt: string }) {
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
      title={new Date(startTimestamp).toLocaleString()}
      aria-live="polite"
    >
      Starts in {formatHltvCountdown(remainingMilliseconds)}
    </time>
  );
}
