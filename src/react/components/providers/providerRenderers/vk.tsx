import { useTranslation } from 'react-i18next';
import type { FeedItemCardProviderRendererProps } from './common';
import { VkIcon } from '../../Icons';

export function VkCopy({ facts, displayHostname }: FeedItemCardProviderRendererProps) {
  const { item, description } = facts;
  return (
    <div className="reader-card__copy reader-card__vk-copy">
      {description && facts.vkStatus !== 'deleted'
        ? <p className="reader-card__description">{description}</p>
        : null}
      <h2 className="reader-card__channel">
        <a
          className="reader-card__vk-channel-link"
          href={item.link}
          target="_blank"
          rel="noreferrer"
        >
          <span className="reader-card__vk-icon"><VkIcon /></span>
          <span>{item.title || displayHostname}</span>
        </a>
      </h2>
    </div>
  );
}

export function VkDeletedPreview({ facts }: Pick<FeedItemCardProviderRendererProps, 'facts'>) {
  const { t } = useTranslation();
  return (
    <a
      className="reader-card__preview reader-card__vk-deleted-preview"
      href={facts.item.link}
      target="_blank"
      rel="noreferrer"
      aria-label={t('preview.postDeleted')}
    >
      <span className="reader-card__vk-deleted-icon" aria-hidden="true" />
      <span>{t('preview.postDeleted')}</span>
    </a>
  );
}
