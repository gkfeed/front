import type { HltvRoundOutcome } from '../../../../shared/previewContracts';

export function HltvRoundIcon({ outcome }: { outcome: HltvRoundOutcome }) {
  if (outcome === 'bomb_exploded') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="14" r="5.5" />
        <path d="M11 8.5V6m0 0 2-2m-2 2-2-2M16 10l2-1m-1 5h3M6 10 4 9m1 5H2" />
      </svg>
    );
  }
  if (outcome === 'bomb_defused') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="14" r="5.5" />
        <path d="m8 14 2 2 5-6M11 8.5V6m0 0 2-2" />
      </svg>
    );
  }
  if (outcome === 'stopwatch') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="13" r="6.5" />
        <path d="M12 3v3M9 3h6m-3 10V9m0 4 3 2" />
      </svg>
    );
  }
  if (outcome === 'ct_win') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m12 3 7 3v5c0 4.5-2.8 7.7-7 10-4.2-2.3-7-5.5-7-10V6l7-3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    );
  }
  if (outcome === 't_win') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 9.5C7 6.5 9 5 12 5s5 1.5 5 4.5v5c0 2.8-2.2 4.5-5 4.5s-5-1.7-5-4.5v-5Z" />
        <path d="M9.5 12h.1m4.8 0h.1M9 16c1.8 1 4.2 1 6 0M12 5V3m-3 1 1 1m5-1-1 1" />
      </svg>
    );
  }
  return <span className="reader-card__hltv-round-history-dot" aria-hidden="true" />;
}
