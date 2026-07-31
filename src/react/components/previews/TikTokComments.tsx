import { useTranslation } from 'react-i18next';

import type { FeedItem } from '../../types';
import { useTikTokComments } from '../../hooks/useTikTokComments';
import { useTikTokCommentsPreference } from '../../hooks/useTikTokCommentsPreference';
import { UserIcon } from '../Icons';
import { normalizeExternalText } from '../../../../shared/text';

export function TikTokComments({ item }: { item: FeedItem }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useTikTokCommentsPreference();
  const {
    comments,
    remoteDescription,
    creator,
    isLoading,
    loadFailed,
    retry,
  } = useTikTokComments(item.link, isExpanded);
  const commentsId = `tiktok-comments-list-${item.id}`;
  const description = getVideoDescription(item.text, item.title) ?? remoteDescription;

  return (
    <aside className="tiktok-comments" aria-label={t('comments.label')}>
      <div className="tiktok-comments__toolbar">
        <h2 id={`tiktok-comments-${item.id}`} className="tiktok-comments__title">
          {t('comments.title')}
        </h2>
        <button
          type="button"
          className="tiktok-comments__toggle"
          aria-expanded={isExpanded}
          aria-controls={commentsId}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? t('comments.hide') : t('comments.show')}
        </button>
      </div>
      {isExpanded && isLoading ? (
        <div id={commentsId} className="tiktok-comments__empty" role="status">
          <p>{t('comments.loading')}</p>
        </div>
      ) : isExpanded && comments && (comments.length > 0 || description) ? (
        <ol id={commentsId} className="tiktok-comments__list">
          {description ? (
            <li className="tiktok-comments__comment tiktok-comments__description">
              {creator ? (
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
              ) : null}
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
          {comments.length === 0 ? (
            <li className="tiktok-comments__empty">
              <p>{t('comments.none')}</p>
              <a href={item.link} target="_blank" rel="noreferrer">
                {t('comments.viewOnTikTok')} <span aria-hidden="true">↗</span>
              </a>
            </li>
          ) : null}
        </ol>
      ) : isExpanded && loadFailed ? (
        <div id={commentsId} className="tiktok-comments__empty" role="alert">
          <p>{t('comments.loadError')}</p>
          <button type="button" className="secondary" onClick={retry}>{t('live.tryAgain')}</button>
        </div>
      ) : isExpanded && comments ? (
        <div id={commentsId} className="tiktok-comments__empty">
          <p>{t('comments.none')}</p>
          <a href={item.link} target="_blank" rel="noreferrer">
            {t('comments.viewOnTikTok')} <span aria-hidden="true">↗</span>
          </a>
        </div>
      ) : null}
    </aside>
  );
}

function getVideoDescription(content: string, title: string): string | null {
  if (!content || typeof DOMParser === 'undefined') return null;

  const document = new DOMParser().parseFromString(content, 'text/html');
  document.querySelectorAll('script, style, noscript').forEach((element) => element.remove());
  const description = normalizeExternalText(document.body.textContent ?? '');
  if (!description || description.toLocaleLowerCase() === normalizeExternalText(title).toLocaleLowerCase()) {
    return null;
  }
  return description;
}

function renderDescription(description: string) {
  return description.split(/(#[\p{L}\p{N}_]+)/gu).map((part, index) => (
    part.startsWith('#')
      ? <strong className="tiktok-comments__hashtag" key={`${index}-${part}`}>{part}</strong>
      : part
  ));
}
