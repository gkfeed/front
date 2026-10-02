import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { LocalizedFeedItemPreview } from '../previewLocalization';
import {
  createImagePresentationFacts,
  imageClippingStyle,
  readImagePresentationMetrics,
  type ImagePresentationMetrics,
} from './feedItemImagePresentation';

export function VkImageCarousel({ href, preview, onPreviewError }: {
  href: string;
  preview: LocalizedFeedItemPreview;
  onPreviewError: () => void;
}) {
  const { t } = useTranslation();
  const carouselRef = useRef<HTMLDivElement>(null);
  const images = preview.imageUrls ?? [preview.src];
  const [index, setIndex] = useState(0);
  const [metrics, setMetrics] = useState<ImagePresentationMetrics | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [remoteFirst, setRemoteFirst] = useState<'pending' | 'loaded' | 'failed'>('pending');
  const current = images[index] ?? images[0]!;
  const firstFallback = index === 0 && remoteFirst !== 'loaded' && preview.fallbackSrc;
  const source = firstFallback || current;
  const presentation = createImagePresentationFacts('vk', metrics?.src === source ? metrics : null);

  const move = (offset: number) => {
    setIndex((currentIndex) => (currentIndex + offset + images.length) % images.length);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const carousel = carouselRef.current;
      if (!carousel || (!carousel.contains(document.activeElement)
        && !carousel.matches(':hover')
        && !carousel.closest('.reader__item--fullscreen'))) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable
        || target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement)) return;
      event.preventDefault();
      setIndex((currentIndex) => (
        currentIndex + (event.key === 'ArrowLeft' ? -1 : 1) + images.length
      ) % images.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length]);

  return (
    <div
      ref={carouselRef}
      className="reader-card__preview reader-card__preview--image reader-card__vk-carousel"
      data-media-orientation={presentation.orientation}
      data-vk-feed-placeholder={presentation.isPlaceholder ? '' : undefined}
      data-image-presentation="vk"
      style={presentation.style}
    >
      <span className="reader-card__image-surface" style={imageClippingStyle}>
        <img
          src={source}
          alt={`${preview.alt} (${index + 1}/${images.length})`}
          referrerPolicy="no-referrer"
          style={imageClippingStyle}
          onLoad={(event) => {
            const nextMetrics = readImagePresentationMetrics(event.currentTarget, source);
            if (nextMetrics) setMetrics(nextMetrics);
          }}
          onError={() => {
            if (firstFallback) {
              if (remoteFirst === 'pending') setRemoteFirst('loaded');
              else onPreviewError();
              return;
            }
            const nextFailed = [...failed, current];
            setFailed(nextFailed);
            const next = images.findIndex((image) => !nextFailed.includes(image));
            if (next >= 0) setIndex(next);
            else onPreviewError();
          }}
        />
      </span>
      <a className="reader-card__vk-carousel-link" href={href} target="_blank" rel="noreferrer"
        aria-label={t('preview.open', { hostname: 'VK' })} />
      {firstFallback && remoteFirst === 'pending' ? (
        <img src={current} alt="" aria-hidden="true" hidden data-preview-preloader=""
          style={{ display: 'none' }} referrerPolicy="no-referrer"
          onLoad={() => setRemoteFirst('loaded')}
          onError={() => setRemoteFirst('failed')} />
      ) : null}
      <div className="reader-card__vk-carousel-controls">
        <button className="reader-card__vk-carousel-arrow reader-card__vk-carousel-arrow--previous"
          type="button" aria-label={t('preview.previousSlide')} onClick={() => move(-1)}>‹</button>
        <span className="reader-card__vk-carousel-count" aria-live="polite">{index + 1} / {images.length}</span>
        <button className="reader-card__vk-carousel-arrow reader-card__vk-carousel-arrow--next"
          type="button" aria-label={t('preview.nextSlide')} onClick={() => move(1)}>›</button>
      </div>
    </div>
  );
}
