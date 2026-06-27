import { useNavigate, useParams } from 'react-router-dom';

import { FeedCard } from '../components/FeedCard';
import { useFeed } from '../hooks/useFeed';

export function FeedPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { feed, isLoading, isDeleting, isConfirmingDelete, loadError, deleteError, requestDelete, cancelDelete, deleteFeed, retryLoad } = useFeed(id, () => navigate('/'));

  return (
    <section className="container" aria-labelledby="feed-page-title">
      <h1 id="feed-page-title" className="page-title">Feed source details</h1>

      {isLoading ? (
        <p className="status" aria-live="polite">Loading feed source</p>
      ) : loadError ? (
        <>
          <p className="status status--error" role="alert">{loadError}</p>
          {loadError.startsWith('Could') ? <button type="button" className="secondary" onClick={retryLoad}>Try again</button> : null}
        </>
      ) : feed ? (
        <>
          <FeedCard feed={feed} asLink={false} />
          <div className="actions">
            {isConfirmingDelete ? (
              <>
                <p className="status" id="delete-confirmation">Delete this feed source? This cannot be undone.</p>
                <div className="actions__confirm" aria-describedby="delete-confirmation">
                  <button type="button" className="secondary" onClick={cancelDelete} disabled={isDeleting} autoFocus>
                    Cancel
                  </button>
                  <button type="button" onClick={deleteFeed} className="delete" disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete feed source'}
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={requestDelete} className="delete" disabled={isDeleting}>
                Delete
              </button>
            )}
            {deleteError ? (
              <p className="status status--error" role="alert">{deleteError}</p>
            ) : isDeleting ? (
              <p className="status" aria-live="polite">Deleting feed source</p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
