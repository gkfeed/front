import { isRezkaProviderData, REZKA_DETAIL_LABELS } from '../../../../../shared/providerData/rezka';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { FeedItemCardModel } from '../../useFeedItemCardModel';
import type { LocalizedFeedItemPreview } from '../../previewLocalization';
import { RezkaFeedAction } from '../../RezkaFeedAction';
import { ArticleReaderLink } from '../../ArticleReader';
import { FeedItemMedia } from '../../previews/FeedItemMedia';
import {
  getSpotifyDisplayTitle,
  getSpotifyReleaseDate,
} from '../../../domain/spotifyPreview';

export type FeedItemCardProviderRendererProps = {
  facts: FeedItemCardModel;
  localizedPreview: LocalizedFeedItemPreview | null;
  displayHostname: string;
  onOpenArticle?: () => void;
  previewPlaceholder?: ReactNode;
};

export type FeedPluginCardContent = { preview: ReactNode; supplementary?: ReactNode; copy?: ReactNode };

export function FeedPluginCardSlots({ facts, previewPlaceholder, preview, supplementary, copy }: FeedItemCardProviderRendererProps & FeedPluginCardContent) {
  const hideCopy = facts.provider !== 'vk'
    && facts.provider !== 'reddit'
    && facts.provider !== 'rezka'
    && (facts.imagePreview.type !== 'none' || facts.provider === 'instagram' || facts.provider === 'tiktok');
  return (
    <Fragment>
      {facts.isPreviewPending ? previewPlaceholder : preview}
      {facts.isPreviewPending ? null : supplementary}
      {facts.isPreviewPending || hideCopy ? null : copy}
    </Fragment>
  );
}

export function GenericCardContent(props: FeedItemCardProviderRendererProps) {
  return <FeedPluginCardSlots {...props} preview={<FeedItemMediaPreview {...props} />} copy={<StandardCopy {...props} />} />;
}

export function FeedItemMediaPreview({
  facts,
  localizedPreview,
  displayHostname,
}: FeedItemCardProviderRendererProps) {
  const { t, i18n } = useTranslation();
  if (!localizedPreview) return null;

  const title = getCardTitle(facts, displayHostname);
  const releaseDate = getSpotifyReleaseDate({
    url: facts.item.link,
    releaseDate: facts.openGraphPreview?.releaseDate,
  });
  const formattedReleaseDate = releaseDate
    ? formatSpotifyReleaseDate(releaseDate, i18n.resolvedLanguage)
    : null;

  return (
    <FeedItemMedia
      href={facts.item.link}
      hostname={title}
      preview={localizedPreview}
      isShortVideo={facts.provider === 'instagram' || facts.provider === 'tiktok'}
      isTikTok={facts.provider === 'tiktok'}
      isSpotify={facts.provider === 'spotify'}
      hltvImageScore={facts.hltvImageScore}
      onPreviewError={facts.onPreviewError}
      imagePresentation={facts.provider === 'vk' ? 'vk' : 'standard'}
      spotifyReleaseDate={releaseDate && formattedReleaseDate ? {
        dateTime: releaseDate,
        text: formattedReleaseDate,
        ariaLabel: t('preview.spotifyReleaseDate', { date: formattedReleaseDate }),
      } : undefined}
    />
  );
}

export function StandardCopy({ facts, displayHostname, onOpenArticle }: FeedItemCardProviderRendererProps) {
  const { t } = useTranslation();
  const { item, description } = facts;
  const title = getCardTitle(facts, displayHostname);

  if (facts.provider === 'rezka') {
    return (
      <div className="reader-card__copy reader-card__rezka-copy">
        <div className="reader-card__rezka-panel" tabIndex={isRezkaProviderData(facts.openGraphPreview?.providerData) ? 0 : undefined}>
          <h2 className="reader-card__title">{title}</h2>
          <RezkaReleaseDate facts={facts} />
          {description ? <p className="reader-card__description">{description}</p> : null}
          <RezkaDetails facts={facts} />
        </div>
        <RezkaFeedAction item={item} />
      </div>
    );
  }

  if ((facts.provider === 'generic'
    || facts.provider === 'onefootball'
    || facts.provider === 'reddit'
    || facts.provider === 'spotify') && facts.simpleImage) {
    return (
      <div className="reader-card__copy">
        <h2 className="reader-card__title">{title}</h2>
      </div>
    );
  }

  return (
    <div className="reader-card__copy">
      <div className="reader-card__meta">
        <span>{displayHostname}</span>
        <span>{t('feed.item')} #{item.feedId}</span>
      </div>
      <h2 className="reader-card__title">{title}</h2>
      {description ? <p className="reader-card__description">{description}</p> : null}
      <ArticleReaderLink
        url={item.link}
        enabled={facts.canReadArticle}
        onOpen={onOpenArticle ?? (() => {})}
      />
    </div>
  );
}

function RezkaReleaseDate({ facts }: { facts: FeedItemCardModel }) {
  const data = facts.openGraphPreview?.providerData;
  if (!isRezkaProviderData(data)) return null;
  const date = data.details.find(({ label }) => label === 'Дата выхода')?.value;
  return date ? <p className="reader-card__rezka-date">{date}</p> : null;
}

function RezkaRatingBadges({ value }: { value: string }) {
  const ratings = value.replace(/\s*\(\s*\d[\d\s.,]*\)/g, '').trim();
  const scores = [...ratings.matchAll(/(imdb|кинопоиск)\s*:\s*(\d+(?:[.,]\d+)?)/giu)];
  if (!scores.length) {
    return ratings ? <span className="reader-card__rezka-badge" role="listitem">{ratings}</span> : null;
  }

  return scores.map(([, source, score], index) => {
    const imdb = source?.toLowerCase() === 'imdb';
    const modifier = imdb ? 'imdb' : 'kinopoisk';
    const name = imdb ? 'IMDb' : 'Кинопоиск';
    return (
      <span className={`reader-card__rezka-badge reader-card__rezka-badge--${modifier}`} role="listitem" key={index}>
        <strong>{name}</strong> {score}
      </span>
    );
  });
}

function RezkaDetails({ facts }: { facts: FeedItemCardModel }) {
  const data = facts.openGraphPreview?.providerData;
  if (!isRezkaProviderData(data)) return null;
  const details = data.details.filter(({ label }) => label !== 'Дата выхода' && REZKA_DETAIL_LABELS.has(label));
  if (!details.length) return null;
  return (
    <div className="reader-card__rezka-details">
      {details.map(({ label, value }, index) => (
        <div className="reader-card__rezka-badges" role="list" aria-label={label} key={`${label}-${index}`}>
          {label === 'Рейтинги' ? <RezkaRatingBadges value={value} /> : value.split(',').map((badge, badgeIndex) => {
            const text = badge.trim();
            const brand = label === 'Из серии' ? /^сериалы\s+(тнт|netflix)$/iu.exec(text)?.[1]?.toUpperCase() : undefined;
            if (!brand) {
              return <span className="reader-card__rezka-badge" role="listitem" key={badgeIndex}>{text}</span>;
            }
            const modifier = brand === 'ТНТ' ? 'tnt' : 'netflix';
            return (
              <span className={`reader-card__rezka-badge reader-card__rezka-badge--${modifier}`} role="listitem" key={badgeIndex}>
                Сериалы <strong>{brand}</strong>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function formatSpotifyReleaseDate(value: string, language?: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!month) return String(year);

  const date = new Date(Date.UTC(year, month - 1, day || 1));
  return new Intl.DateTimeFormat(language, day
    ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function getCardTitle(facts: FeedItemCardModel, displayHostname: string): string {
  if (facts.provider !== 'spotify') return facts.item.title || displayHostname;
  return getSpotifyDisplayTitle({
    url: facts.item.link,
    fallbackTitle: facts.item.title || displayHostname,
    previewTitle: facts.openGraphPreview?.title,
    previewDescription: facts.openGraphPreview?.description,
  });
}

export type ProviderRendererProps<T extends FeedItemCardModel['provider']> = Omit<
  FeedItemCardProviderRendererProps,
  'facts'
> & {
  facts: Extract<FeedItemCardModel, { provider: T }>;
};
