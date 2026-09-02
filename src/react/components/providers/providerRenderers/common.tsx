import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from '../../useFeedItemCardModel';
import type { LocalizedFeedItemPreview } from '../../previewLocalization';
import { ArticleReaderLink } from '../../ArticleReader';
import { FeedItemMedia } from '../../previews/FeedItemMedia';

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

  return (
    <FeedItemMedia
      href={facts.item.link}
      hostname={facts.item.title || displayHostname}
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

  if ((facts.provider === 'generic' || facts.provider === 'onefootball') && facts.simpleImage) {
    return (
      <div className="reader-card__copy">
        <h2 className="reader-card__title">{item.title || displayHostname}</h2>
      </div>
    );
  }

  return (
    <div className="reader-card__copy">
      <div className="reader-card__meta">
        <span>{displayHostname}</span>
        <span>{t('feed.item')} #{item.feedId}</span>
      </div>
      <h2 className="reader-card__title">{item.title || displayHostname}</h2>
      {description ? <p className="reader-card__description">{description}</p> : null}
      <ArticleReaderLink
        url={item.link}
        enabled={facts.canReadArticle}
        onOpen={onOpenArticle ?? (() => {})}
      />
    </div>
  );
}

export type ProviderRendererProps<T extends FeedItemCardModel['provider']> = Omit<
  FeedItemCardProviderRendererProps,
  'facts'
> & {
  facts: Extract<FeedItemCardModel, { provider: T }>;
};
