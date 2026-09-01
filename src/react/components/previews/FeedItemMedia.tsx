import type { ReactNode } from 'react';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import { FeedItemEmbedMedia } from './FeedItemEmbedMedia';
import { FeedItemImageMedia, type ImagePreview } from './FeedItemImageMedia';
import { FeedItemVideoMedia } from './FeedItemVideoMedia';
import { getSpotifyEmbed } from '../../domain/spotifyPreview';
import { SpotifyPlaylistPreview } from './SpotifyPlaylistPreview';
import type { ImagePresentationProfile } from './feedItemImagePresentation';

type FeedItemMediaProps = {
  href: string;
  hostname: string;
  preview: LocalizedFeedItemPreview;
  isShortVideo: boolean;
  isTikTok: boolean;
  hltvImageScore: [string, string] | null;
  onPreviewError: () => void;
  overlay?: ReactNode;
  imagePresentation?: ImagePresentationProfile;
};

export function FeedItemMedia({
  href,
  hostname,
  preview,
  isShortVideo,
  isTikTok,
  hltvImageScore,
  onPreviewError,
  overlay,
  imagePresentation = 'standard',
}: FeedItemMediaProps) {
  if (preview.type === 'video') {
    return (
      <FeedItemVideoMedia
        preview={preview as LocalizedFeedItemPreview & { type: 'video' }}
        isShortVideo={isShortVideo}
        isTikTok={isTikTok}
        onPreviewError={onPreviewError}
        overlay={overlay}
      />
    );
  }

  if (preview.type === 'embed') {
    return (
      <FeedItemEmbedMedia
        preview={preview as LocalizedFeedItemPreview & { type: 'embed' }}
        isShortVideo={isShortVideo}
        isTikTok={isTikTok}
        overlay={overlay}
      />
    );
  }

  const spotifyEmbed = getSpotifyEmbed(href);
  if (spotifyEmbed) {
    return (
      <SpotifyPlaylistPreview
        embedUrl={spotifyEmbed.url}
        embedHeight={spotifyEmbed.height}
        spotifyUrl={href}
        imageSrc={preview.src}
        imageAlt={preview.alt}
        title={hostname}
        onPreviewError={onPreviewError}
      />
    );
  }

  return (
    <FeedItemImageMedia
      href={href}
      hostname={hostname}
      preview={preview as ImagePreview}
      isShortVideo={isShortVideo}
      isTikTok={isTikTok}
      hltvImageScore={hltvImageScore}
      onPreviewError={onPreviewError}
      overlay={overlay}
      presentationProfile={imagePresentation}
    />
  );
}
