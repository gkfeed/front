import { useTranslation } from 'react-i18next';

import { getRedditStatus, isRedditProviderData } from '../../../../../shared/providerData/reddit';
import type { FeedItemCardProviderRendererProps } from './common';
import { FeedItemMediaPreview } from './common';

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
  if (getRedditStatus(facts.openGraphPreview?.providerData) === 'deleted') return null;
  const title = facts.openGraphPreview?.title || facts.item.title || displayHostname;
  const data = facts.openGraphPreview?.providerData;
  const details = isRedditProviderData(data) && data.status === 'active' ? data : null;
  return (
    <div className="reader-card__copy">
      <h2 className="reader-card__title">
        <a href={facts.item.link} target="_blank" rel="noreferrer">{title}</a>
      </h2>
      {details && <div className="reddit-discussion" tabIndex={0}>
        {details.body && <div className="reddit-discussion__post">
          {details.author && <strong>u/{details.author}</strong>}
          <p>{details.body}</p>
        </div>}
        {details.comments.length > 0 && <section aria-label="Comments">
          <h3>Comments <span>{details.comments.length}</span></h3>
          <ol>{details.comments.map((comment, index) => <li key={index} style={{ marginInlineStart: `${comment.depth * 16}px` }}>
            <strong>u/{comment.author}</strong><p>{comment.text}</p>
          </li>)}</ol>
        </section>}
      </div>}
    </div>
  );
}
