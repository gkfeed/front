import type { FeedItemCardProviderRendererProps } from './common';

export function VkCopy({ model, displayHostname }: FeedItemCardProviderRendererProps) {
  const { item, description } = model;
  return (
    <div className="reader-card__copy reader-card__vk-copy">
      <h2 className="reader-card__channel">{item.title || displayHostname}</h2>
      {description ? <p className="reader-card__description">{description}</p> : null}
    </div>
  );
}
