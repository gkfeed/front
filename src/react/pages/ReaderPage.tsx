import { FeedItemCard } from '../components/FeedItemCard';
import { useFeedReader } from '../hooks/useFeedReader';

export function ReaderPage() {
  const {
    currentItem,
    isLoading,
    isDeleting,
    loadFailed,
    deleteFailed,
    remainingCount,
    keepItem,
    deleteItem,
    retryLoad,
  } = useFeedReader();

  return (
    <section className="reader" aria-labelledby="reader-page-title">
      <h1 id="reader-page-title" className="sr-only">Reader</h1>

      {isLoading ? <ReaderLoading /> : null}

      {loadFailed ? (
        <div className="reader__state" role="alert">
          <p>Could not load your feed items.</p>
          <button type="button" className="secondary" onClick={retryLoad}>Try again</button>
        </div>
      ) : null}

      {!isLoading && !loadFailed && !currentItem ? (
        <div className="reader__state">
          <span className="reader__done-mark" aria-hidden="true">✓</span>
          <h2>You’re all caught up</h2>
          <p>There are no more items in this reading session.</p>
          <button type="button" className="secondary" onClick={retryLoad}>Check again</button>
        </div>
      ) : null}

      {currentItem ? (
        <div className="reader__item">
          <FeedItemCard key={currentItem.id} item={currentItem} />
          <div className="reader__actions" aria-label="Feed item actions">
            <button type="button" className="reader__keep" onClick={keepItem} disabled={isDeleting}>
              <span aria-hidden="true">✓</span> Keep
            </button>
            <button type="button" className="delete" onClick={deleteItem} disabled={isDeleting}>
              <span aria-hidden="true">×</span> {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
          {deleteFailed ? (
            <p className="status status--error reader__error" role="alert">
              Could not delete this item. It is still in your feed; try again.
            </p>
          ) : null}
          <div className="reader__count-row">
            <span className="reader__count">{remainingCount} remaining</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReaderLoading() {
  return (
    <div className="reader__loading" role="status" aria-label="Loading feed items">
      <div className="reader__loading-line reader__loading-line--short" />
      <div className="reader__loading-line reader__loading-line--title" />
      <div className="reader__loading-line" />
      <div className="reader__loading-line" />
    </div>
  );
}
