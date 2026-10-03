import type { FeedItemCardProviderRendererProps } from './common';

export function RedditCopy({ facts, displayHostname }: FeedItemCardProviderRendererProps) {
  const title = facts.openGraphPreview?.title || facts.item.title || displayHostname;
  return (
    <div className="reader-card__copy">
      <h2 className="reader-card__title">
        <a href={facts.item.link} target="_blank" rel="noreferrer">{title}</a>
      </h2>
    </div>
  );
}
