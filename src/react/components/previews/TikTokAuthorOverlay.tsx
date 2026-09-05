import { useState } from 'react';
import type { TikTokPlaybackAuthor } from '../../../../shared/tiktokContracts';

export function TikTokAuthorOverlay({ author }: { author: TikTokPlaybackAuthor }) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const name = author.name || author.username;
  if (!name) return null;

  return (
    <div className="reader-card__tiktok-author">
      <span className="reader-card__tiktok-author-avatar" aria-hidden="true">
        {author.avatarUrl && failedAvatar !== author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailedAvatar(author.avatarUrl)}
          />
        ) : name.slice(0, 1)}
      </span>
      <span className="reader-card__tiktok-author-text">
        <strong className="reader-card__tiktok-author-name" title={name}>{name}</strong>
        {author.username ? (
          <span className="reader-card__tiktok-author-username" title={author.username}>
            {author.username}
          </span>
        ) : null}
      </span>
    </div>
  );
}
