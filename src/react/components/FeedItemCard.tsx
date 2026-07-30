import { InstagramIcon } from './Icons';
import {
  FeedItemCardCopy,
  FeedItemCardPreview,
  FeedItemCardSupplementary,
} from './FeedItemCardContent';
import { useFeedItemCardModel } from './useFeedItemCardModel';

export function FeedItemCard({ item }: { item: Parameters<typeof useFeedItemCardModel>[0] }) {
  const model = useFeedItemCardModel(item);
  const {
    cardRef,
    isPreviewPending,
    isLiquipedia,
    isYoutube,
    isShortVideo,
    isTikTok,
    isInstagram,
    isInstagramPhoto,
    isSimpleImageCard,
    isImagePreviewOnly,
    isReddit,
    isHltv,
    shouldBlurNsfw,
    shouldHideNsfw,
  } = model;

  if (shouldHideNsfw) return null;

  return (
    <article
      ref={cardRef}
      className={[
        'reader-card',
        isPreviewPending ? 'reader-card--preview-pending' : '',
        isLiquipedia ? 'reader-card--liquipedia' : '',
        isYoutube ? 'reader-card--youtube' : '',
        isShortVideo ? 'reader-card--short-video' : '',
        isTikTok ? 'reader-card--tiktok' : '',
        isInstagram ? 'reader-card--instagram' : '',
        isInstagramPhoto ? 'reader-card--instagram-photo' : '',
        isSimpleImageCard ? 'reader-card--simple-image' : '',
        isImagePreviewOnly ? 'reader-card--image-preview' : '',
        isImagePreviewOnly && isReddit ? 'reader-card--reddit-preview' : '',
        isImagePreviewOnly && isHltv ? 'reader-card--hltv-preview' : '',
        shouldBlurNsfw ? 'reader-card--nsfw-blurred' : '',
      ].filter(Boolean).join(' ')}
      inert={shouldBlurNsfw}
    >
      {shouldBlurNsfw ? (
        <div className="reader-card__nsfw-shield" aria-hidden="true">
          <strong>NSFW</strong>
          <span>Hidden by settings</span>
        </div>
      ) : null}
      {isInstagram ? (
        <div className="reader-card__short-video-identity">
          <span className="reader-card__short-video-logo"><InstagramIcon /></span>
          <span>{getInstagramUsername(item.title)}</span>
        </div>
      ) : null}
      <FeedItemCardPreview model={model} />
      <FeedItemCardSupplementary model={model} />
      <FeedItemCardCopy model={model} />
    </article>
  );
}

function getInstagramUsername(title: string): string {
  return title.replace(/^inst:\s*/i, '').trim() || 'Instagram';
}
