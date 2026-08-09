import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LinkIcon } from './Icons';

export function CopyLinkButton({
  url,
  className,
  compact = false,
}: {
  url: string;
  className: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const label = isCopied ? t('comments.linkCopied') : t('comments.copyLink');

  useEffect(() => {
    setIsCopied(false);
  }, [url]);

  useEffect(() => {
    if (!isCopied) return undefined;
    const timeout = window.setTimeout(() => setIsCopied(false), 2_000);
    return () => window.clearTimeout(timeout);
  }, [isCopied]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <button type="button" className={className} aria-label={compact ? label : undefined} onClick={copyLink}>
      {compact ? <LinkIcon /> : null}
      <span className={compact ? 'sr-only' : undefined} aria-live="polite">{label}</span>
    </button>
  );
}
