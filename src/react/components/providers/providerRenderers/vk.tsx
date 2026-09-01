import type { FeedItemCardProviderRendererProps } from './common';
import { VkIcon } from '../../Icons';

export function VkCopy({ facts, displayHostname }: FeedItemCardProviderRendererProps) {
  const { item, description } = facts;
  return (
    <div className="reader-card__copy reader-card__vk-copy">
      {description ? <p className="reader-card__description">{description}</p> : null}
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
