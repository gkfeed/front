import { useTranslation } from 'react-i18next';

import type { TikTokComment } from '../../../../shared/tiktokContracts';
import { UserIcon } from '../Icons';

type TikTokCreator = {
  name: string;
  avatarUrl: string | null;
} | null;

export function TikTokCommentsContent({
  comments,
  creator,
  description,
  isLoading,
  loadFailed,
  commentsId,
  itemLink,
  onRetry,
}: {
  comments: TikTokComment[] | null;
  creator: TikTokCreator;
  description: string | null;
  isLoading: boolean;
  loadFailed: boolean;
  commentsId: string;
  itemLink: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div id={commentsId} className="tiktok-comments__empty" role="status">
        <p>{t('comments.loading')}</p>
      </div>
    );
  }

  if (comments && (comments.length > 0 || description)) {
    return (
      <ol id={commentsId} className="tiktok-comments__list">
        {description ? (
          <li className="tiktok-comments__comment tiktok-comments__description">
            {creator ? <TikTokCreatorIdentity creator={creator} /> : null}
            <p>{renderDescription(description)}</p>
          </li>
        ) : null}
        {comments.map((comment, index) => (
          <li className="tiktok-comments__comment" key={`${index}-${comment.text}`}>
            <div className="tiktok-comments__identity">
              <span className="tiktok-comments__avatar">
                {comment.avatarUrl ? (
                  <img src={comment.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon />
                )}
              </span>
              <span className="tiktok-comments__author">
                <strong>{comment.author}</strong>
                {comment.username ? <small>@{comment.username}</small> : null}
              </span>
            </div>
            <p>{comment.text}</p>
          </li>
        ))}
        {comments.length === 0 ? <TikTokCommentsEmptyItem itemLink={itemLink} /> : null}
      </ol>
    );
  }

  if (loadFailed) {
    return (
      <div id={commentsId} className="tiktok-comments__empty" role="alert">
        <p>{t('comments.loadError')}</p>
        <button type="button" className="ui-button--secondary" onClick={onRetry}>{t('live.tryAgain')}</button>
      </div>
    );
  }

  return comments ? <TikTokCommentsEmpty commentsId={commentsId} itemLink={itemLink} /> : null;
}

function TikTokCreatorIdentity({ creator }: { creator: NonNullable<TikTokCreator> }) {
  return (
    <div className="tiktok-comments__creator">
      <span className="tiktok-comments__creator-avatar">
        {creator.avatarUrl ? (
          <img src={creator.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <UserIcon />
        )}
      </span>
      <strong>{creator.name}</strong>
    </div>
  );
}

function TikTokCommentsEmpty({
  commentsId,
  itemLink,
}: {
  commentsId?: string;
  itemLink: string;
}) {
  const { t } = useTranslation();

  return (
    <div id={commentsId} className="tiktok-comments__empty">
      <p>{t('comments.none')}</p>
      <a href={itemLink} target="_blank" rel="noreferrer">
        {t('comments.viewOnTikTok')} <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

function TikTokCommentsEmptyItem({ itemLink }: { itemLink: string }) {
  const { t } = useTranslation();

  return (
    <li className="tiktok-comments__empty">
      <p>{t('comments.none')}</p>
      <a href={itemLink} target="_blank" rel="noreferrer">
        {t('comments.viewOnTikTok')} <span aria-hidden="true">↗</span>
      </a>
    </li>
  );
}

function renderDescription(description: string) {
  return description.split(/(#[\p{L}\p{N}_]+)/gu).map((part, index) => (
    part.startsWith('#')
      ? <strong className="tiktok-comments__hashtag" key={`${index}-${part}`}>{part}</strong>
      : part
  ));
}
