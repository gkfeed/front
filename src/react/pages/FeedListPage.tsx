import { useTranslation } from 'react-i18next';

import '../../styles/feeds.css';
import { useFeedsList } from '../adapters/feeds/useFeedsList';
import { FeedsList } from '../components/FeedsList';

export function FeedListPage() {
  const { t } = useTranslation();
  const model = useFeedsList(t);

  return (
    <section aria-labelledby="feeds-page-title">
      <h1 id="feeds-page-title" className="page-title">{t('pages.feedSources')}</h1>
      <FeedsList model={model} />
    </section>
  );
}
