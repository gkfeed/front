import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import '../../styles/feeds.css';
import { FeedCard } from '../components/FeedCard';
import {
  useFeedPageModel,
  type FeedDeleteStatus,
} from '../adapters/feeds/useFeedPageModel';
import { getRequestErrorMessage } from '../services/authError';

export function FeedPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const handleDeleted = useCallback(() => navigate('/'), [navigate]);
  const {
    feed,
    loadStatus,
    loadError,
    deleteStatus,
    requestDelete,
    cancelDelete,
    deleteFeed,
    retryLoad,
  } = useFeedPageModel(id, handleDeleted);

  let content: ReactNode = null;

  if (loadStatus === 'loading') {
    content = <p className="ui-status" aria-live="polite">{t('feedDetails.loading')}</p>;
  } else if (loadStatus === 'not-found' || loadStatus === 'error') {
    content = (
      <LoadErrorState
        message={loadStatus === 'not-found'
          ? t('feedDetails.notFound')
          : getRequestErrorMessage(loadError, t, 'feedDetails.loadError')}
        canRetry={loadStatus === 'error'}
        onRetry={retryLoad}
      />
    );
  } else if (feed) {
    content = (
      <>
        <FeedCard feed={feed} asLink={false} />
          <DeleteActions
          deleteStatus={deleteStatus}
          onRequestDelete={requestDelete}
          onCancelDelete={cancelDelete}
          onDelete={deleteFeed}
        />
      </>
    );
  }

  return (
    <section className="container" aria-labelledby="feed-page-title">
      <h1 id="feed-page-title" className="page-title">{t('pages.feedDetails')}</h1>
      {content}
    </section>
  );
}

function LoadErrorState({ message, canRetry, onRetry }: { message: string; canRetry: boolean; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      <p className="ui-status ui-status--error" role="alert">{message}</p>
      {canRetry ? (
        <button type="button" className="ui-button--secondary" onClick={onRetry}>{t('live.tryAgain')}</button>
      ) : null}
    </>
  );
}

function DeleteActions({
  deleteStatus,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  deleteStatus: FeedDeleteStatus;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const isConfirmingDelete = deleteStatus !== 'idle';
  const isDeleting = deleteStatus === 'deleting';

  return (
    <div className="ui-actions">
      {isConfirmingDelete ? (
        <>
          <p className="ui-status" id="delete-confirmation">{t('feedDetails.deleteQuestion')}</p>
          <div className="ui-actions__confirm" aria-describedby="delete-confirmation">
            <button type="button" className="ui-button--secondary" onClick={onCancelDelete} disabled={isDeleting} autoFocus>
              {t('auth.cancel')}
            </button>
            <button type="button" onClick={onDelete} className="ui-button--danger" disabled={isDeleting}>
              {isDeleting ? t('feedDetails.deleting') : t('feedDetails.deleteSource')}
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={onRequestDelete} className="ui-button--danger" disabled={isDeleting}>
          {t('feedDetails.delete')}
        </button>
      )}
      {deleteStatus === 'error' ? (
        <p className="ui-status ui-status--error" role="alert">{t('feedDetails.deleteError')}</p>
      ) : isDeleting ? (
        <p className="ui-status" aria-live="polite">{t('feedDetails.deletingSource')}</p>
      ) : null}
    </div>
  );
}
