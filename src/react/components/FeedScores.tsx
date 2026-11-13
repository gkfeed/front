import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { RECOMMENDATION_CATEGORIES, type FeedRecommendationScore } from '../../../shared/recommendationScoring';
import type { RecommendationCategory } from '../../../shared/recommendationEvents';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { getFeedRecommendationScores } from '../services/feedRecommendationScores';
import { useAuth } from '../state/useAuth';
import { getRecommendationSubjectId } from '../telemetry/recommendationSubject';
import type { Feed } from '../types';
import { getFeedIcon } from './feedIcons';

import '../../styles/feed-scores.css';

export function FeedScores({ feeds }: { feeds: Feed[] }) {
  const { t, i18n } = useTranslation();
  const { credentials } = useAuth();
  const username = credentials?.username;
  const [sort, setSort] = useState('samples');
  const [query, setQuery] = useState('');
  const load = useCallback((signal: AbortSignal) => {
    if (!username) throw new Error('Missing score subject');
    return getFeedRecommendationScores(getRecommendationSubjectId(username), signal);
  }, [username]);
  const { result, error, isLoading, retry } = useAsyncResource(load, { enabled: !!username, key: username });
  const scores = result?.feeds ?? [];
  const titles = useMemo(() => new Map(feeds.map((feed) => [feed.id, feed])), [feeds]);
  const total = scores.reduce((sum, score) => sum + score.itemCount, 0);
  const number = new Intl.NumberFormat(i18n.language);
  const percent = (fraction: number) => new Intl.NumberFormat(i18n.language, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
  const rows = scores.filter((score) => `${titles.get(score.feedId)?.title ?? ''} ${score.feedId}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (sort === 'viewed' ? b.probabilities.delete_after_viewing - a.probabilities.delete_after_viewing : 0)
      || b.itemCount - a.itemCount || a.feedId - b.feedId);

  return (
    <section className="feed-scores" aria-labelledby="feed-scores-title">
      <header className="feed-scores__header">
        <div><p className="feed-scores__eyebrow">{t('feedScores.eyebrow')}</p>
          <h2 id="feed-scores-title">{t('feedScores.title')}</h2>
          <p className="feed-scores__description">{t('feedScores.description')}</p></div>
        <button className="ui-button--secondary feed-scores__refresh" type="button" onClick={retry} disabled={isLoading}>{t('feedScores.refresh')}</button>
      </header>
      {isLoading ? <p role="status" className="feed-scores__state">{t('feedScores.loading')}</p> : error ? (
        <p role="alert" className="feed-scores__state">{t('feedScores.error')}</p>
      ) : !scores.length ? (
        <div className="feed-scores__state"><h3>{t('feedScores.emptyTitle')}</h3><p>{t('feedScores.emptyDescription')}</p>
          <Link to="/reader?view=review">{t('feedScores.openReader')}</Link></div>
      ) : <>
        <div className="feed-scores__summary">
          {RECOMMENDATION_CATEGORIES.map((category) => {
            const count = scores.reduce((sum, score) => sum + score.counts[category], 0);
            return <div className="feed-scores__summary-card" data-category={category} key={category}>
              <span className="feed-scores__summary-label"><CategoryDot category={category} />{t(`feedScores.categories.${category}`)}</span>
              <strong>{percent(count / total)}</strong><span className="feed-scores__summary-count">{t('feedScores.items', { count, formatted: number.format(count) })}</span>
            </div>;
          })}
        </div>
        <div className="feed-scores__toolbar">
          <p>{t('feedScores.coverage', { feeds: number.format(scores.length), items: number.format(total) })}</p>
          <div className="feed-scores__filters">
            <input type="search" aria-label={t('feedScores.search')} placeholder={t('feedScores.search')} value={query} onChange={(event) => setQuery(event.target.value)} />
            <select aria-label={t('feedScores.sort')} value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="samples">{t('feedScores.sortSamples')}</option><option value="viewed">{t('feedScores.sortViewed')}</option>
            </select>
          </div>
        </div>
        <div className="feed-scores__table">
          <div className="feed-scores__columns" aria-hidden="true"><span>{t('feedScores.source')}</span><span>{t('feedScores.distribution')}</span><span>{t('feedScores.observations')}</span></div>
          <ul className="feed-scores__rows">
            {rows.map((score) => <ScoreRow key={score.feedId} score={score} feed={titles.get(score.feedId)} percent={percent} />)}
          </ul>
          {!rows.length ? <p className="feed-scores__state">{t('feed.noMatching')}</p> : null}
        </div>
        <p className="feed-scores__note"><span aria-hidden="true">◷</span>{t('feedScores.note')}</p>
      </>}
    </section>
  );
}

function ScoreRow({ score, feed, percent }: { score: FeedRecommendationScore; feed?: Feed; percent: (value: number) => string }) {
  const { t, i18n } = useTranslation();
  const title = feed?.title || t('feedScores.unknownFeed', { id: score.feedId });
  const icon = feed ? getFeedIcon(feed) : null;
  return <li className="feed-scores__row">
    <div className="feed-scores__source">
      <span className="feed-scores__icon" aria-hidden="true">{icon ? <svg viewBox="0 0 48 48"><path d={icon.path} fill="currentColor" /></svg> : '#'}</span>
      <div className="feed-scores__identity"><Link to={`/feed/${score.feedId}`}>{title}</Link>
        <span className="feed-scores__badge" data-category={score.category ?? 'mixed'}>{score.category ? t(`feedScores.categories.${score.category}`) : t('feedScores.mixed')}</span></div>
    </div>
    <div className="feed-scores__distribution">
      <div className="feed-scores__bar" role="img" aria-label={t('feedScores.barLabel', { title,
        keep: percent(score.probabilities.keep_for_later), skip: percent(score.probabilities.delete_immediately), viewed: percent(score.probabilities.delete_after_viewing) })}>
        {RECOMMENDATION_CATEGORIES.map((category) => <span key={category} data-category={category} style={{ width: `${score.probabilities[category] * 100}%` }}
          title={`${t(`feedScores.categories.${category}`)}: ${percent(score.probabilities[category])} · ${score.counts[category]}`} />)}
      </div>
      <div className="feed-scores__percentages" aria-hidden="true">{RECOMMENDATION_CATEGORIES.map((category) => <span key={category}><CategoryDot category={category} />{percent(score.probabilities[category])}</span>)}</div>
    </div>
    <div className="feed-scores__sample"><strong>{new Intl.NumberFormat(i18n.language).format(score.itemCount)}</strong><span>{t('feedScores.sampleLabel', { count: score.itemCount })}</span></div>
  </li>;
}

function CategoryDot({ category }: { category: RecommendationCategory }) {
  return <span className="feed-scores__dot" data-category={category} aria-hidden="true" />;
}
