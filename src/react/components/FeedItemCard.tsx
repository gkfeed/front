import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FeedItemCardContent } from './FeedItemCardContent';
import { useFeedItemCardModel } from './useFeedItemCardModel';
import { ArticleReaderOverlay } from './ArticleReader';
import { useArticleReader } from '../hooks/useArticleReader';
import { useTikTokCommentsPreference } from '../hooks/useTikTokCommentsPreference';
import { isRezkaUrl, parseUrl } from '../domain/feedItemUrls';
import { getFeedItemCardClassNames } from './providers/feedItemCardClassNames';

export const FeedItemCard = memo(function FeedItemCard({
  item,
}: {
  item: Parameters<typeof useFeedItemCardModel>[0];
}) {
  const { t } = useTranslation();
  const model = useFeedItemCardModel(item);
  const [areTikTokCommentsExpanded] = useTikTokCommentsPreference();
  const articleReader = useArticleReader(item.link);
  const { cardRef, isPreviewPending, shouldBlurNsfw, shouldHideNsfw } = model;
  if (shouldHideNsfw) return null;

  return (
    <article
      ref={cardRef}
      className={[
        'reader-card',
        isPreviewPending ? 'reader-card--preview-pending' : '',
        ...getFeedItemCardClassNames(model),
        isRezkaUrl(parseUrl(item.link)) ? 'reader-card--rezka' : '',
        shouldBlurNsfw ? 'reader-card--nsfw-blurred' : '',
      ].filter(Boolean).join(' ')}
      data-comments-expanded={model.provider === 'tiktok'
        ? areTikTokCommentsExpanded
        : undefined}
      inert={shouldBlurNsfw}
      onClickCapture={(event) => {
        if (!model.canReadArticle || articleReader.isOpen) return;
        const target = event.target instanceof Element ? event.target : null;
        const previewLink = target?.closest('.reader-card__preview[href]');
        if (!previewLink) return;
        event.preventDefault();
        articleReader.open();
      }}
    >
      {shouldBlurNsfw ? (
        <div className="reader-card__nsfw-shield" aria-hidden="true">
          <strong>NSFW</strong>
          <span>{t('preview.hidden')}</span>
        </div>
      ) : null}
      <FeedItemCardContent facts={model} onOpenArticle={articleReader.open} />
      <ArticleReaderOverlay reader={articleReader} originalUrl={item.link} />
    </article>
  );
});
