import { InstagramIcon } from '../../Icons';
import type { FeedItemCardProviderRendererProps } from './common';

export function InstagramIdentity({ model }: FeedItemCardProviderRendererProps) {
  if (!model.descriptor.showInstagramIdentity) return null;
  const username = model.item.title.replace(/^inst:\s*/i, '').trim() || 'Instagram';
  return (
    <div className="reader-card__short-video-identity">
      <span className="reader-card__short-video-logo"><InstagramIcon /></span>
      <span>{username}</span>
    </div>
  );
}
