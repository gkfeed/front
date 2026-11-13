import { useTranslation } from 'react-i18next';

import { useFeedsList } from '../adapters/feeds/useFeedsList';
import { FeedScores } from '../components/FeedScores';

export function FeedScoresPage() {
  const { t } = useTranslation();
  const model = useFeedsList(t);

  return (
    <section className="feed-scores-page" aria-labelledby="scores-page-title">
      <h1 id="scores-page-title" className="sr-only">{t('feedScores.tab')}</h1>
      <FeedScores feeds={model.feeds} />
    </section>
  );
}
