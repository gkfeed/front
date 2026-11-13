import { useTranslation } from 'react-i18next';

import { RECOMMENDATION_CATEGORIES, type FeedRecommendationScore } from '../../../shared/recommendationScoring';
import '../../styles/feed-score-bar.css';

export function FeedScoreBar({ score, title, large = false }: {
  score?: FeedRecommendationScore;
  title: string;
  large?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const percent = (value: number) => new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 0 }).format(value);
  const label = score ? t('feedScores.barLabel', { title,
    keep: percent(score.probabilities.keep_for_later),
    skip: percent(score.probabilities.delete_immediately),
    viewed: percent(score.probabilities.delete_after_viewing),
  }) : t('feedScores.noScore', { title });

  return (
    <div className={`feed-score-bar${large ? ' feed-score-bar--large' : ''}`} role="img" aria-label={label} title={label}>
      {score ? RECOMMENDATION_CATEGORIES.map((category) => (
        <span key={category} data-category={category} aria-hidden="true"
          style={{ flexGrow: score.probabilities[category], display: score.counts[category] ? undefined : 'none' }}
          title={`${t(`feedScores.categories.${category}`)}: ${percent(score.probabilities[category])} · ${score.counts[category]}`} />
      )) : null}
    </div>
  );
}
