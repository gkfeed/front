import { describe, expect, it } from 'vitest';

import {
  getInstagramEmbedUrl,
  getInstagramEmbedPreview,
  getKnownInstagramVideoEmbedPreview,
  isAmbiguousInstagramPostUrl,
  isInstagramMediaUrl,
} from './instagramPreview';

describe('Instagram previews', () => {
  it('creates canonical embed URLs for Instagram media', () => {
    expect(getInstagramEmbedUrl('https://www.instagram.com/reel/AbC_123/?igsh=example'))
      .toBe('https://www.instagram.com/reel/AbC_123/embed/');
    expect(getInstagramEmbedUrl('https://instagram.com/reels/AbC-123/'))
      .toBe('https://www.instagram.com/reel/AbC-123/embed/');
    expect(getInstagramEmbedUrl('https://www.instagram.com/p/Photo123/'))
      .toBe('https://www.instagram.com/p/Photo123/embed/');
  });

  it('creates embed previews for Reel and universal post paths', () => {
    expect(getInstagramEmbedPreview(
      new URL('https://www.instagram.com/reel/Video123/'),
      'inst: creator',
    )).toEqual({
      src: 'https://www.instagram.com/reel/Video123/embed/',
      alt: { kind: 'video', title: 'inst: creator' },
      type: 'embed',
    });
    expect(getInstagramEmbedPreview(
      new URL('https://www.instagram.com/p/Photo123/'),
      'inst: creator',
    )).toEqual({
      src: 'https://www.instagram.com/p/Photo123/embed/',
      alt: { kind: 'video', title: 'inst: creator' },
      type: 'embed',
    });
  });

  it('requires remote metadata before treating a universal post path as video', () => {
    expect(getKnownInstagramVideoEmbedPreview(
      new URL('https://www.instagram.com/reel/Video123/'),
      'inst: creator',
    )).not.toBeNull();
    expect(getKnownInstagramVideoEmbedPreview(
      new URL('https://www.instagram.com/p/Video123/'),
      'inst: creator',
    )).toBeNull();
    expect(isAmbiguousInstagramPostUrl(
      new URL('https://www.instagram.com/p/Video123/'),
    )).toBe(true);
  });

  it('rejects lookalike domains, profiles, credentials, and non-HTTP URLs', () => {
    for (const value of [
      'https://instagram.com.example.org/reel/Video123/',
      'https://www.instagram.com/creator/',
      'https://user@www.instagram.com/reel/Video123/',
      'ftp://www.instagram.com/reel/Video123/',
    ]) {
      expect(getInstagramEmbedUrl(value)).toBeNull();
    }
    expect(isInstagramMediaUrl(new URL('https://www.instagram.com/reel/Video123/'))).toBe(true);
  });
});
