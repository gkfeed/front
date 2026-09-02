import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from './useFeedItemCardModel';
import { localizeFeedItemPreview } from './previewLocalization';
import { FeedItemCardProviderContent } from './providers/FeedItemCardProviderContent';

export function FeedItemCardContent({
  facts,
  onOpenArticle,
}: {
  facts: FeedItemCardModel;
  onOpenArticle?: () => void;
}) {
  const { t } = useTranslation();
  const localizedPreview = facts.visiblePreview
    ? localizeFeedItemPreview(facts.visiblePreview, t)
    : null;

  return (
    <FeedItemCardProviderContent
      facts={facts}
      localizedPreview={localizedPreview}
      displayHostname={facts.hostname ?? t('feed.item')}
      previewPlaceholder={(
        <div
          className="reader-card__preview-placeholder"
          role="status"
          aria-label={t('preview.loading')}
        />
      )}
      onOpenArticle={onOpenArticle}
    />
  );
}
