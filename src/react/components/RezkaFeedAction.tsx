import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { findRezkaFeed, rezkaTitleId } from '../domain/rezkaFeed';
import { AuthContext } from '../state/authContext';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
import type { Feed, FeedItem } from '../types';

type State = { status: 'loading' | 'ready' | 'saving' | 'error' | 'saved'; feed?: Feed };

export function RezkaFeedAction({ item }: { item: FeedItem }) {
  const auth = useContext(AuthContext);
  const { feeds } = useFeatureUseCases();
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const titleId = rezkaTitleId(item.link);

  useEffect(() => {
    if (!auth || !titleId) return;
    const controller = new AbortController();
    void feeds.loadFeeds(auth.credentials, controller.signal).then((all) => {
      if (!controller.signal.aborted) setState({ status: 'ready', feed: findRezkaFeed(all, item.link) });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ status: 'error' });
    });
    return () => controller.abort();
  }, [auth, feeds, item.link, titleId, attempt]);

  if (!auth || !titleId) return null;
  async function add() {
    if (state.status !== 'ready' || state.feed || !auth) return;
    setState({ status: 'saving' });
    try {
      const all = await feeds.loadFeeds(auth.credentials);
      const existing = findRezkaFeed(all, item.link);
      if (existing) { setState({ status: 'ready', feed: existing }); return; }
      await feeds.saveFeed({ title: item.title, type: 'rezka', url: item.link }, 'extended', auth.credentials);
      setState({ status: 'saved' });
      try {
        const updated = await feeds.loadFeeds(auth.credentials);
        const created = findRezkaFeed(updated, item.link);
        if (created) setState({ status: 'ready', feed: created });
      } catch { /* The feed was created; keep the success state. */ }
    } catch {
      setState({ status: 'error' });
    }
  }

  return (
    <div className="reader-card__rezka-feed-action">
      {state.feed ? <Link className="reader-card__rezka-feed-button" to={`/feed/${state.feed.id}`}>{t('rezka.inFeed')}</Link>
        : state.status === 'saved' ? <><span role="status">{t('rezka.added')}</span><button type="button" className="reader-card__rezka-feed-button" onClick={() => { setState({ status: 'loading' }); setAttempt((n) => n + 1); }}>{t('rezka.refreshFeed')}</button></>
          : state.status === 'error' ? <><span role="alert">{t('rezka.feedError')}</span><button type="button" className="reader-card__rezka-feed-button" onClick={() => { setState({ status: 'loading' }); setAttempt((n) => n + 1); }}>{t('rezka.retry')}</button></>
            : <button type="button" className="reader-card__rezka-feed-button" disabled={state.status !== 'ready'} onClick={() => void add()}>{t(state.status === 'saving' ? 'rezka.adding' : state.status === 'loading' ? 'rezka.checking' : 'rezka.addToFeed')}</button>}
    </div>
  );
}
