import { useTranslation } from 'react-i18next';

export function TikTokNormalizeButton({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const label = t('preview.normalizeSound');
  return (
    <button type="button" className="reader-card__normalize-toggle"
      aria-label={label} title={label} aria-pressed={enabled} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M4 9v6h3l4 3V6L7 9H4Z" />
        <path d="M16 9v6m-3-3h6" />
      </svg>
    </button>
  );
}
