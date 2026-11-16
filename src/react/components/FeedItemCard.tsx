import { memo, useEffect } from 'react';
import { readerDiagnostic } from '../services/readerDiagnostics';
import { parseLiveballMatch } from '../domain/liveballMatch';
import { isTelegramPost } from './TelegramPost';
import { useTranslation } from 'react-i18next';
import { FeedItemCardContent } from './FeedItemCardContent';
import { useFeedItemCardModel } from './useFeedItemCardModel';
import { ArticleReaderOverlay } from './ArticleReader';
import { useArticleReader } from '../hooks/useArticleReader';
import { useTikTokCommentsPreference } from '../hooks/useTikTokCommentsPreference';
import { getFeedItemCardClassNames } from './providers/feedItemCardClassNames';

export const FeedItemCard = memo(function FeedItemCard({
  item,
  sourceTitle,
}: {
  item: Parameters<typeof useFeedItemCardModel>[0];
  sourceTitle?: string;
}) {
  const { t } = useTranslation();
  const model = useFeedItemCardModel(item);
  const [areTikTokCommentsExpanded] = useTikTokCommentsPreference();
  const articleReader = useArticleReader(item.link);
  const { cardRef, isPreviewPending, shouldBlurNsfw, shouldHideNsfw } = model;
  useEffect(() => {
    readerDiagnostic('item-visible-status', item.id, `${model.provider}:${model.previewStatus}`);
  }, [item.id, model.provider, model.previewStatus]);
  if (shouldHideNsfw) return null;
  const isLiveballMatch = model.provider === 'liveball' && Boolean(parseLiveballMatch(item));

  return (
    <article
      ref={cardRef}
      className={[
        'reader-card',
        isTelegramPost(item.link) ? 'reader-card--telegram' : '',
        isPreviewPending && !isLiveballMatch ? 'reader-card--preview-pending' : '',
        isLiveballMatch ? 'reader-card--liveball' : '',
        ...getFeedItemCardClassNames(model),
        shouldBlurNsfw ? 'reader-card--nsfw-blurred' : '',
      ].filter(Boolean).join(' ')}
      data-comments-expanded={model.provider === 'tiktok'
        ? areTikTokCommentsExpanded
        : undefined}
      inert={shouldBlurNsfw}
      onLoadCapture={import.meta.env.DEV ? (event) => {
        if (event.target instanceof HTMLImageElement) readerDiagnostic('item-visible-image-ready', item.id, model.provider);
        else if (event.target instanceof HTMLIFrameElement) readerDiagnostic('item-visible-frame-loaded', item.id, model.provider);
      } : undefined}
      onLoadedDataCapture={import.meta.env.DEV ? (event) => {
        if (event.target instanceof HTMLVideoElement) readerDiagnostic('item-visible-video-ready', item.id, model.provider);
      } : undefined}
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
      <FeedItemCardContent facts={model} sourceTitle={sourceTitle} onOpenArticle={articleReader.open} />
      <ArticleReaderOverlay reader={articleReader} originalUrl={item.link} />
    </article>
  );
});
