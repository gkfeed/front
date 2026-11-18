import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

import { getRedditStatus, isRedditProviderData } from '../../../../../shared/providerData/reddit';
import type { FeedItemCardProviderRendererProps } from './common';
import { FeedItemMediaPreview } from './common';

function getAvatarHue(author: string) {
  let hue = 0;
  for (const character of author.toLowerCase()) {
    hue = (hue * 31 + character.charCodeAt(0)) % 360;
  }
  return hue;
}

function RedditCommentImage({ src, href, label }: { src: string; href: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <a href={href} target="_blank" rel="noreferrer">{label}</a>
    : <a href={src} target="_blank" rel="noreferrer">
        <img src={src} alt={label} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </a>;
}

export function RedditPreview(props: FeedItemCardProviderRendererProps) {
  const { t } = useTranslation();
  if (getRedditStatus(props.facts.openGraphPreview?.providerData) !== 'deleted') {
    return <FeedItemMediaPreview {...props} />;
  }

  return (
    <div className="reader-card__preview reader-card__preview--image reader-card__preview--reddit-deleted">
      <div className="reader-card__media-error" role="alert">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m5.6 5.6 12.8 12.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <strong>{t('preview.postDeleted')}</strong>
        <a className="reader-card__media-error-url" href={props.facts.item.link} target="_blank" rel="noreferrer">
          {props.facts.item.link}
        </a>
      </div>
    </div>
  );
}

export function RedditCopy({ facts, displayHostname }: FeedItemCardProviderRendererProps) {
  const { t } = useTranslation();
  if (getRedditStatus(facts.openGraphPreview?.providerData) === 'deleted') return null;
  const title = facts.openGraphPreview?.title || facts.item.title || displayHostname;
  const [, flair, heading] = title.match(/^\[([^\[\]\r\n]+)\]\s+(\S[\s\S]*)$/) ?? [];
  const badge = flair?.trim();
  const postId = facts.item.link.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i)?.[1];
  const data = facts.openGraphPreview?.providerData;
  const details = isRedditProviderData(data) && data.status === 'active' ? data : null;
  const ancestors = new Map<number, string>();
  const imageLabel = t('comments.viewImageOnReddit');
  return (
    <div className={`reader-card__copy${details ? ' reader-card__copy--reddit-discussion' : ''}`}>
      <article className="reddit-post">
        {(details?.author || badge) && (
          <div className="reddit-post__meta">
            {details?.author && <span>u/{details.author}</span>}
            {badge && <span className="reddit-post__flair">{badge}</span>}
          </div>
        )}
        <h2 className="reader-card__title">
          <a href={facts.item.link} target="_blank" rel="noreferrer">
            {badge ? heading : title}
          </a>
        </h2>
        {details?.body && <p>{details.body}</p>}
      </article>
      {details && details.comments.length > 0 && <section className="reddit-discussion" aria-label={t('comments.title')}>
        <ol tabIndex={0} aria-label={t('comments.title')}>
          {details.comments.map((comment, index) => {
            const hue = getAvatarHue(comment.author);
            const depth = Math.max(0, Math.trunc(comment.depth));
            for (const level of ancestors.keys()) {
              if (level >= depth) ancestors.delete(level);
            }
            const parent = comment.replyTo ?? ancestors.get(depth - 1);
            const replyLabel = parent ? t('comments.replyToRedditUser', { user: parent }) : t('comments.redditReply');
            ancestors.set(depth, comment.author);
            const href = postId && comment.id
              ? `https://www.reddit.com/comments/${postId}/_/${comment.id}/`
              : facts.item.link;
            const text = comment.text.replace(/<image>/gi, '').trim();
            const hasImageMarker = /<image>/i.test(comment.text);
            return (
              <li
                key={comment.id ?? index}
                data-reply={depth > 0 ? '' : undefined}
              >
                <span
                  className="reddit-discussion__avatar"
                  aria-hidden="true"
                  style={{ '--reddit-avatar-hue': hue } as CSSProperties}
                >
                  {comment.author.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <div className="reddit-discussion__byline">
                    <strong>u/{comment.author}</strong>
                    {depth > 0 && (
                      <svg
                        className="reddit-discussion__reply"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        role="img"
                        aria-label={replyLabel}
                      >
                        <title>{replyLabel}</title>
                        <path d="M2.5 2.5v4a3 3 0 0 0 3 3h7m-3-3 3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  {(hasImageMarker || Boolean(comment.images?.length)) && (
                    <div className="reddit-discussion__images">
                      {comment.images?.length
                        ? comment.images.map(src => <RedditCommentImage key={src} src={src} href={href} label={imageLabel} />)
                        : <a href={href} target="_blank" rel="noreferrer">{imageLabel}</a>}
                    </div>
                  )}
                  {text && <p>{text}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </section>}
    </div>
  );
}
