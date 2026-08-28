import { useTranslation } from 'react-i18next';
import {
  FeedItemCardCopy,
  FeedItemCardIdentity,
  FeedItemCardPreview,
  FeedItemCardSupplementary,
} from './FeedItemCardContent';
import { useFeedItemCardModel } from './useFeedItemCardModel';
import { ArticleReaderOverlay } from './ArticleReader';
import { useArticleReader } from '../hooks/useArticleReader';

export function FeedItemCard({ item }: { item: Parameters<typeof useFeedItemCardModel>[0] }) {
  const { t } = useTranslation();
  const model = useFeedItemCardModel(item);
  const articleReader = useArticleReader(item.link);
  const { cardRef, isPreviewPending, descriptor, shouldBlurNsfw, shouldHideNsfw } = model;
  const canReadArticle = model.provider !== 'vk' && (
    model.openGraphPreview?.type?.toLowerCase() === 'article'
    || model.hostname === 'trashbox.ru'
    || model.hostname?.endsWith('.trashbox.ru') === true
  );

  if (shouldHideNsfw) return null;

  return (
    <article
      ref={cardRef}
      className={[
        'reader-card',
        isPreviewPending ? 'reader-card--preview-pending' : '',
        descriptor.className,
        shouldBlurNsfw ? 'reader-card--nsfw-blurred' : '',
      ].filter(Boolean).join(' ')}
      inert={shouldBlurNsfw}
      onClickCapture={(event) => {
        if (!canReadArticle || articleReader.isOpen) return;
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
      <FeedItemCardIdentity model={model} />
      <FeedItemCardPreview model={model} />
      <FeedItemCardSupplementary model={model} />
      <FeedItemCardCopy model={model} onOpenArticle={articleReader.open} />
      <ArticleReaderOverlay reader={articleReader} originalUrl={item.link} />
    </article>
  );
}
