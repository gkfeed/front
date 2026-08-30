import type { FeedItemCardProviderRendererProps } from './common';
import { VkIcon } from '../../Icons';

export function VkCopy({ model, displayHostname }: FeedItemCardProviderRendererProps) {
  const { item, description } = model;
  return (
    <div className="reader-card__copy reader-card__vk-copy">
      {description ? <p className="reader-card__description">{description}</p> : null}
      <h2 className="reader-card__channel">
        <span className="reader-card__vk-icon"><VkIcon /></span>
        <span>{item.title || displayHostname}</span>
      </h2>
    </div>
  );
}
