import { useTranslation } from 'react-i18next';

import '../../styles/feeds.css';
import { FeedsList } from '../components/FeedsList';

export function FeedListPage() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="feeds-page-title">
      <h1 id="feeds-page-title" className="page-title">{t('pages.feedSources')}</h1>
      <FeedsList />
    </section>
  );
}
