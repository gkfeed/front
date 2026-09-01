import { InstagramIcon } from '../../Icons';
import { FeedItemMedia } from '../../previews/FeedItemMedia';
import type { FeedItemCardProviderRendererProps } from './common';

export function InstagramPreview(props: FeedItemCardProviderRendererProps) {
  const { facts, localizedPreview, displayHostname } = props;
  if (!localizedPreview || facts.descriptor.preview.type !== 'media') return null;

  return (
    <FeedItemMedia
      href={facts.item.link}
      hostname={facts.item.title || displayHostname}
      preview={localizedPreview}
      isShortVideo={facts.descriptor.preview.isShortVideo}
      isTikTok={facts.descriptor.preview.isTikTok}
      hltvImageScore={facts.hltvImageScore}
      onPreviewError={facts.onPreviewError}
      overlay={<InstagramIdentity {...props} />}
    />
  );
}

export function InstagramIdentity({ facts }: FeedItemCardProviderRendererProps) {
  if (!facts.descriptor.showInstagramIdentity) return null;
  const username = facts.item.title.replace(/^inst:\s*/i, '').trim() || 'Instagram';
  return (
    <div className="reader-card__short-video-identity">
      <span className="reader-card__short-video-logo"><InstagramIcon /></span>
      <span>{username}</span>
    </div>
  );
}
