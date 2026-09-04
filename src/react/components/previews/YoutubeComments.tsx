import { useTranslation } from 'react-i18next';

import { useYoutubeComments } from '../../hooks/useYoutubeComments';
import { UserIcon } from '../Icons';

export function YoutubeComments({ videoId, isOpen }: { videoId: string; isOpen: boolean }) {
  const { t } = useTranslation();
  const { status, comments, retry } = useYoutubeComments(videoId, isOpen);
  if (!isOpen) return null;

  return (
    <aside id={`youtube-comments-${videoId}`} className="youtube-comments" aria-label={t('youtubeComments.title')}>
      {status === 'loading' ? <p className="youtube-comments__state" role="status">{t('youtubeComments.loading')}</p> : null}
      {status === 'error' ? (
        <div className="youtube-comments__state" role="alert">
          <p>{t('youtubeComments.loadError')}</p>
          <button type="button" onClick={retry}>{t('live.tryAgain')}</button>
        </div>
      ) : null}
      {comments?.length === 0 ? (
        <div className="youtube-comments__state">
          <p>{t('youtubeComments.none')}</p>
          <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}#comments`} target="_blank" rel="noreferrer">
            {t('youtubeComments.viewOnYoutube')} <span aria-hidden="true">↗</span>
          </a>
        </div>
      ) : null}
      {comments && comments.length > 0 ? (
        <ol className="youtube-comments__list">
          {comments.map((comment) => (
            <li key={comment.id} className="youtube-comments__comment">
              <span className="youtube-comments__avatar">
                {comment.avatarUrl ? <img src={comment.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <UserIcon />}
              </span>
              <div>
                <strong>{comment.author}</strong>
                {comment.publishedTime ? <small>{comment.publishedTime}</small> : null}
                <p>{comment.text}</p>
                {comment.likeCount ? <small>♥ {comment.likeCount}</small> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </aside>
  );
}
