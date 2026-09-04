import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from '../../useFeedItemCardModel';
import type { LocalizedFeedItemPreview } from '../../previewLocalization';
import { ArticleReaderLink } from '../../ArticleReader';
import { FeedItemMedia } from '../../previews/FeedItemMedia';
import { getSpotifyDisplayTitle } from '../../../domain/spotifyPreview';

export type FeedItemCardProviderRendererProps = {
  facts: FeedItemCardModel;
  localizedPreview: LocalizedFeedItemPreview | null;
  displayHostname: string;
  onOpenArticle?: () => void;
};

export function FeedItemMediaPreview({
  facts,
  localizedPreview,
  displayHostname,
}: FeedItemCardProviderRendererProps) {
  if (!localizedPreview) return null;

  const title = getCardTitle(facts, displayHostname);

  return (
    <FeedItemMedia
      href={facts.item.link}
      hostname={title}
      preview={localizedPreview}
      isShortVideo={facts.provider === 'instagram' || facts.provider === 'tiktok'}
      isTikTok={facts.provider === 'tiktok'}
      hltvImageScore={facts.hltvImageScore}
      onPreviewError={facts.onPreviewError}
      imagePresentation={facts.provider === 'vk' ? 'vk' : 'standard'}
    />
  );
}

export function StandardCopy({ facts, displayHostname, onOpenArticle }: FeedItemCardProviderRendererProps) {
  const { t } = useTranslation();
  const { item, description } = facts;
  const title = getCardTitle(facts, displayHostname);

  if ((facts.provider === 'generic' || facts.provider === 'onefootball') && facts.simpleImage) {
    return (
      <div className="reader-card__copy">
        <h2 className="reader-card__title">{title}</h2>
      </div>
    );
  }

  return (
    <div className="reader-card__copy">
      <div className="reader-card__meta">
        <span>{displayHostname}</span>
        <span>{t('feed.item')} #{item.feedId}</span>
      </div>
      <h2 className="reader-card__title">{title}</h2>
      {description ? <p className="reader-card__description">{description}</p> : null}
      <ArticleReaderLink
        url={item.link}
        enabled={facts.canReadArticle}
        onOpen={onOpenArticle ?? (() => {})}
      />
    </div>
  );
}

function getCardTitle(facts: FeedItemCardModel, displayHostname: string): string {
  return getSpotifyDisplayTitle({
    url: facts.item.link,
    fallbackTitle: facts.item.title || displayHostname,
    previewTitle: facts.openGraphPreview?.title,
    previewDescription: facts.openGraphPreview?.description,
  });
}

export type ProviderRendererProps<T extends FeedItemCardModel['provider']> = Omit<
  FeedItemCardProviderRendererProps,
  'facts'
> & {
  facts: Extract<FeedItemCardModel, { provider: T }>;
};
