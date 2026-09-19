import { useTranslation } from 'react-i18next';

import { InstagramIcon } from '../../Icons';
import { FeedItemMedia } from '../../previews/FeedItemMedia';
import type { FeedItemCardProviderRendererProps } from './common';

export function InstagramPreview(props: FeedItemCardProviderRendererProps) {
  const { facts, localizedPreview, displayHostname } = props;
  if (!localizedPreview) {
    return <InstagramMediaError url={facts.preview?.src ?? facts.item.link} />;
  }

  return (
    <FeedItemMedia
      href={facts.item.link}
      hostname={facts.item.title || displayHostname}
      preview={localizedPreview}
      isShortVideo
      isTikTok={false}
      hltvImageScore={facts.hltvImageScore}
      onPreviewError={facts.onPreviewError}
      overlay={<InstagramIdentity {...props} />}
    />
  );
}

function InstagramMediaError({ url }: { url: string }) {
  const { t } = useTranslation();

  return (
    <div className="reader-card__preview reader-card__preview--short-video reader-card__preview--instagram">
      <div className="reader-card__media-error" role="alert">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 3 2.8 19h18.4L12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M12 8v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="1" fill="currentColor" />
        </svg>
        <strong>{t('preview.mediaUnavailable')}</strong>
        <span>{t('preview.mediaError')}</span>
        <a className="reader-card__media-error-url" href={url} target="_blank" rel="noreferrer">
          {url}
        </a>
      </div>
    </div>
  );
}

export function InstagramIdentity({ facts }: FeedItemCardProviderRendererProps) {
  const username = facts.item.title.replace(/^inst:\s*/i, '').trim() || 'Instagram';
  return (
    <div className="reader-card__short-video-identity">
      <span className="reader-card__short-video-logo"><InstagramIcon /></span>
      <span>{username}</span>
    </div>
  );
}
