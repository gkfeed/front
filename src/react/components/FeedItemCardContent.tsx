import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from './useFeedItemCardModel';
import { localizeFeedItemPreview } from './previewLocalization';
import { FeedItemCardProviderContent } from './providers/FeedItemCardProviderContent';
import { FeedItemMediaPreview, StandardCopy } from './providers/providerRenderers/common';
import { PluginRenderBoundary } from './PluginRenderBoundary';

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

  const displayHostname = facts.hostname ?? t('feed.item');
  const genericFacts = { ...facts, provider: 'generic', simpleImage: false } as FeedItemCardModel;
  const sharedProps = { facts: genericFacts, localizedPreview, displayHostname, onOpenArticle };

  return (
    <PluginRenderBoundary
      key={`${facts.provider}:${facts.item.id}`}
      pluginId={facts.provider}
      fallback={(
        <>
          <FeedItemMediaPreview {...sharedProps} />
          <StandardCopy {...sharedProps} />
        </>
      )}
    >
      <FeedItemCardProviderContent
        facts={facts}
        localizedPreview={localizedPreview}
        displayHostname={displayHostname}
        previewPlaceholder={(
          <div
            className="reader-card__preview-placeholder"
            role="status"
            aria-label={t('preview.loading')}
          />
        )}
        onOpenArticle={onOpenArticle}
      />
    </PluginRenderBoundary>
  );
}
