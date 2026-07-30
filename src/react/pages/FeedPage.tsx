import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';

import { FeedCard } from '../components/FeedCard';
import { useFeed } from '../hooks/useFeed';

export function FeedPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const handleDeleted = useCallback(() => navigate('/'), [navigate]);
  const {
    feed,
    isLoading,
    isDeleting,
    isConfirmingDelete,
    canRetryLoad,
    loadError,
    deleteError,
    requestDelete,
    cancelDelete,
    deleteFeed,
    retryLoad,
  } = useFeed(id, handleDeleted);

  let content: ReactNode = null;

  if (isLoading) {
    content = <p className="status" aria-live="polite">Loading feed source</p>;
  } else if (loadError) {
    content = <LoadErrorState message={loadError} canRetry={canRetryLoad} onRetry={retryLoad} />;
  } else if (feed) {
    content = (
      <>
        <FeedCard feed={feed} asLink={false} />
        <DeleteActions
          isConfirmingDelete={isConfirmingDelete}
          isDeleting={isDeleting}
          deleteError={deleteError}
          onRequestDelete={requestDelete}
          onCancelDelete={cancelDelete}
          onDelete={deleteFeed}
        />
      </>
    );
  }

  return (
    <section className="container" aria-labelledby="feed-page-title">
      <h1 id="feed-page-title" className="page-title">Feed source details</h1>
      {content}
    </section>
  );
}

function LoadErrorState({ message, canRetry, onRetry }: { message: string; canRetry: boolean; onRetry: () => void }) {
  return (
    <>
      <p className="status status--error" role="alert">{message}</p>
      {canRetry ? (
        <button type="button" className="secondary" onClick={onRetry}>Try again</button>
      ) : null}
    </>
  );
}

function DeleteActions({
  isConfirmingDelete,
  isDeleting,
  deleteError,
  onRequestDelete,
  onCancelDelete,
  onDelete,
}: {
  isConfirmingDelete: boolean;
  isDeleting: boolean;
  deleteError: string;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="actions">
      {isConfirmingDelete ? (
        <>
          <p className="status" id="delete-confirmation">Delete this feed source? This cannot be undone.</p>
          <div className="actions__confirm" aria-describedby="delete-confirmation">
            <button type="button" className="secondary" onClick={onCancelDelete} disabled={isDeleting} autoFocus>
              Cancel
            </button>
            <button type="button" onClick={onDelete} className="delete" disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete feed source'}
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={onRequestDelete} className="delete" disabled={isDeleting}>
          Delete
        </button>
      )}
      {deleteError ? (
        <p className="status status--error" role="alert">{deleteError}</p>
      ) : isDeleting ? (
        <p className="status" aria-live="polite">Deleting feed source</p>
      ) : null}
    </div>
  );
}
