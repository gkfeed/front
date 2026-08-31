import { InstagramIcon } from '../../Icons';
import { FeedItemMedia } from '../../previews/FeedItemMedia';
import type { FeedItemCardProviderRendererProps } from './common';

export function InstagramPreview(props: FeedItemCardProviderRendererProps) {
  const { model, localizedPreview, displayHostname } = props;
  if (!localizedPreview || model.descriptor.preview.type !== 'media') return null;

  return (
    <FeedItemMedia
      href={model.item.link}
      hostname={model.item.title || displayHostname}
      preview={localizedPreview}
      isShortVideo={model.descriptor.preview.isShortVideo}
      isTikTok={model.descriptor.preview.isTikTok}
      hltvImageScore={model.hltvImageScore}
      onPreviewError={model.onPreviewError}
      overlay={<InstagramIdentity {...props} />}
    />
  );
}

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
