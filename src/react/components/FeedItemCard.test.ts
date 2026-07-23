// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import type { FeedItem } from '../types';
import { getFeedItemPreview } from './feedItemPreview';

function item(overrides: Partial<FeedItem>): FeedItem {
  return {
    id: 1,
    feedId: 2,
    link: 'https://example.com/story',
    title: 'Story',
    text: '',
    ...overrides,
  };
}

describe('getFeedItemPreview', () => {
  it('builds the same live Twitch thumbnail used by gkbot', () => {
    expect(getFeedItemPreview(item({ link: 'https://www.twitch.tv/some_channel' }))).toEqual({
      src: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_some_channel-1920x1080.jpg',
      alt: 'some_channel Twitch preview',
    });
  });

  it('builds thumbnails for common YouTube URLs', () => {
    expect(getFeedItemPreview(item({ link: 'https://youtu.be/abc123xyz' })))?.toMatchObject({
      src: 'https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg',
    });
    expect(getFeedItemPreview(item({ link: 'https://www.youtube.com/shorts/xyz987abc' })))?.toMatchObject({
      src: 'https://i.ytimg.com/vi/xyz987abc/hqdefault.jpg',
    });
  });

  it('uses an image embedded in feed content', () => {
    expect(getFeedItemPreview(item({ text: '<p>Summary</p><img src="https://cdn.example.com/cover.jpg">' }))).toEqual({
      src: 'https://cdn.example.com/cover.jpg',
      alt: 'Preview for Story',
    });
  });

  it('uses direct and embedded video media', () => {
    expect(getFeedItemPreview(item({ link: 'https://cdn.example.com/story.mp4' }))).toMatchObject({
      src: 'https://cdn.example.com/story.mp4',
      type: 'video',
    });
    expect(getFeedItemPreview(item({
      text: '<video poster="https://cdn.example.com/poster.jpg"><source src="https://cdn.example.com/story.webm"></video>',
    }))).toMatchObject({
      src: 'https://cdn.example.com/story.webm',
      poster: 'https://cdn.example.com/poster.jpg',
      type: 'video',
    });
  });

  it('rejects unsafe embedded image sources', () => {
    expect(getFeedItemPreview(item({ text: '<img src="javascript:alert(1)">' }))).toBeNull();
    expect(getFeedItemPreview(item({ text: '<img src="data:text/html;base64,PHNjcmlwdD4=">' }))).toBeNull();
  });
});
