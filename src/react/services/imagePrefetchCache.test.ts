// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImagePrefetchCache } from './imagePrefetchCache';

afterEach(() => vi.unstubAllGlobals());

function trackImages() {
  const images: HTMLImageElement[] = [];
  vi.stubGlobal('Image', class {
    constructor() {
      const image = document.createElement('img');
      images.push(image);
      return image;
    }
  });
  return images;
}

describe('image prefetch memory ownership', () => {
  it('keeps recent images warm while releasing old requests throughout a long session', () => {
    const images = trackImages();
    const cache = new ImagePrefetchCache();
    for (let id = 0; id < 500; id++) cache.prefetch(`https://example.com/${id}.jpg`, id);
    expect(images.filter((image) => image.hasAttribute('src'))).toHaveLength(32);
    expect(images[0]!.onload).toBeNull();
    expect(images.at(-1)!.src).toBe('https://example.com/499.jpg');
    cache.prefetch('https://example.com/499.jpg', 499);
    expect(images).toHaveLength(500);
    cache.clear();
    expect(images.every((image) => !image.hasAttribute('src') && image.onload === null && image.onerror === null)).toBe(true);
  });

  it('bounds inline data by size while preserving speculative decoding', () => {
    const images = trackImages();
    const cache = new ImagePrefetchCache();
    for (let id = 0; id < 12; id++) {
      cache.prefetch(`data:image/jpeg;base64,${String(id).padStart(2, '0')}${'a'.repeat(2_000_000)}`, id);
    }
    expect(images.filter((image) => image.hasAttribute('src'))).toHaveLength(4);
    cache.prefetch(`data:image/jpeg;base64,${'a'.repeat(9_000_000)}`, 1);
    cache.prefetch(`https://example.com/${'a'.repeat(4096)}`, 2);
    expect(images).toHaveLength(12);
    cache.prefetch('https://example.com/next.jpg', 3);
    expect(images).toHaveLength(13);
  });

  it('retries failed images and releases their callbacks', () => {
    const images = trackImages();
    const cache = new ImagePrefetchCache();
    cache.prefetch('https://example.com/image.jpg', 1);
    images[0]!.dispatchEvent(new Event('error'));
    expect(images[0]!.hasAttribute('src')).toBe(false);
    cache.prefetch('https://example.com/image.jpg', 1);
    expect(images).toHaveLength(2);
    cache.clear();
  });
});
