import { readerDiagnostic } from './readerDiagnostics';

const MAX_IMAGES = 32;
const MAX_URL_LENGTH = 2048;
const MAX_SOURCE_CHARS = 8 * 1024 * 1024;

/** Own speculative image requests so navigation cannot accumulate them. */
export class ImagePrefetchCache {
  private sourceChars = 0;
  private readonly images = new Map<string, HTMLImageElement>();

  prefetch(src: string, itemId: number): void {
    // Keep inline image decoding warm too, but budget their actual data size.
    // Entry count alone cannot bound multi-megabyte base64 sources.
    const inline = /^data:image\/(?:avif|gif|jpeg|png|webp);base64,/i.test(src);
    if (typeof Image === 'undefined' || src.length > MAX_SOURCE_CHARS
      || (!inline && (src.length > MAX_URL_LENGTH || !/^https?:\/\//i.test(src)))) return;
    const existing = this.images.get(src);
    if (existing) {
      this.images.delete(src);
      this.images.set(src, existing);
      return;
    }
    while (this.images.size >= MAX_IMAGES || this.sourceChars + src.length > MAX_SOURCE_CHARS) {
      const oldest = this.images.keys().next().value!;
      this.remove(oldest);
    }
    const image = new Image();
    this.images.set(src, image);
    this.sourceChars += src.length;
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      image.onload = image.onerror = null;
      readerDiagnostic('item-prefetch-image-ready', itemId);
    };
    image.onerror = () => {
      this.remove(src);
      readerDiagnostic('item-prefetch-image-error', itemId);
    };
    image.src = src;
  }

  clear(): void {
    for (const src of this.images.keys()) this.remove(src);
  }

  private remove(src: string): void {
    const image = this.images.get(src);
    if (!image) return;
    image.onload = image.onerror = null;
    image.removeAttribute('src');
    this.images.delete(src);
    this.sourceChars -= src.length;
  }
}
