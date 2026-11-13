import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import '../../styles/feeds.css';
import { useFeedsList } from '../adapters/feeds/useFeedsList';
import { FeedScores } from '../components/FeedScores';
import { FeedsList } from '../components/FeedsList';

export function FeedListPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const showScores = params.get('tab') === 'scores';
  const model = useFeedsList(t);
  const changeView = (scores: boolean) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (scores) next.set('tab', 'scores');
    else next.delete('tab');
    return next;
  });

  return (
    <section aria-labelledby="feeds-page-title">
      <h1 id="feeds-page-title" className="page-title">{t('pages.feedSources')}</h1>
      <div className="feed-view-tabs" role="group" aria-label={t('feedScores.views')}>
        {[false, true].map((scores) => <button type="button" key={String(scores)} aria-pressed={scores === showScores}
          onClick={() => changeView(scores)}>
          {t(scores ? 'feedScores.tab' : 'nav.list')}
        </button>)}
      </div>
      {showScores ? <FeedScores feeds={model.feeds} /> : <FeedsList model={model} />}
    </section>
  );
}
