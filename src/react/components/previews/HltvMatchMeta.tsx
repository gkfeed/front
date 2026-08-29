import { useTranslation } from 'react-i18next';

export function HltvMatchMeta({
  tournament,
  startsAt,
}: {
  tournament?: string | null;
  startsAt: string | null;
}) {
  const { i18n } = useTranslation();
  const timestamp = startsAt ? Date.parse(startsAt) : Number.NaN;
  const hasDate = Number.isFinite(timestamp);
  if (!tournament && !hasDate) return null;

  return (
    <div className="reader-card__hltv-meta">
      {tournament ? <strong>{tournament}</strong> : null}
      {tournament && hasDate ? <span aria-hidden="true">·</span> : null}
      {hasDate ? (
        <time dateTime={startsAt ?? undefined}>
          {new Intl.DateTimeFormat(i18n.language, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(timestamp)}
        </time>
      ) : null}
    </div>
  );
}
