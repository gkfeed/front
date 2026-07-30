// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import type { FeedItem } from '../types';
import {
  getFeedItemPreview,
  isHltvFeedItem,
  isInstagramFeedItem,
  isLiquipediaFeedItem,
  isShortVideoFeedItem,
  isTikTokFeedItem,
  isVkFeedItem,
} from './feedItemPreview';

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
    expect(getFeedItemPreview(item({ link: 'https://youtu.be/abc123xyz' }))).toMatchObject({
      src: 'https://i.ytimg.com/vi/abc123xyz/maxresdefault.jpg',
      fallbackSrc: 'https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg',
    });
    expect(getFeedItemPreview(item({ link: 'https://www.youtube.com/shorts/xyz987abc' }))).toMatchObject({
      src: 'https://i.ytimg.com/vi/xyz987abc/maxresdefault.jpg',
      fallbackSrc: 'https://i.ytimg.com/vi/xyz987abc/hqdefault.jpg',
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

  it('builds VK video embeds from video links and feed iframe markup', () => {
    expect(getFeedItemPreview(item({
      link: 'https://vk.com/video-123_456',
    }))).toMatchObject({
      src: 'https://vk.com/video_ext.php?oid=-123&id=456&hd=2&autoplay=1',
      type: 'embed',
    });

    expect(getFeedItemPreview(item({
      link: 'https://vk.com/wall-123_789?z=clip-123_456',
    }))).toMatchObject({
      src: 'https://vk.com/clip_ext.php?oid=-123&id=456&hd=2&autoplay=1',
      type: 'embed',
    });

    expect(getFeedItemPreview(item({
      text: '<iframe src="https://vkvideo.ru/video_ext.php?oid=-123&amp;id=456&amp;hash=secret"></iframe>',
    }))).toMatchObject({
      src: 'https://vk.com/video_ext.php?oid=-123&id=456&hash=secret&autoplay=1',
      type: 'embed',
    });

    expect(getFeedItemPreview(item({
      link: 'https://vk.ru/video_ext.php?oid=-123&id=456&hash=secret',
    }))).toMatchObject({
      src: 'https://vk.com/video_ext.php?oid=-123&id=456&hash=secret&autoplay=1',
      type: 'embed',
    });
  });

  it('rejects unsafe embedded image sources', () => {
    expect(getFeedItemPreview(item({ text: '<img src="javascript:alert(1)">' }))).toBeNull();
    expect(getFeedItemPreview(item({ text: '<img src="data:text/html;base64,PHNjcmlwdD4=">' }))).toBeNull();
  });
});

describe('isTikTokFeedItem', () => {
  it('recognizes TikTok links without matching lookalike domains', () => {
    expect(isTikTokFeedItem(item({ link: 'https://www.tiktok.com/@creator/video/123' }))).toBe(true);
    expect(isTikTokFeedItem(item({ link: 'https://m.tiktok.com/v/123' }))).toBe(true);
    expect(isTikTokFeedItem(item({ link: 'https://tiktok.com.example.org/video/123' }))).toBe(false);
  });
});

describe('Instagram feed items', () => {
  it('recognizes the feed title marker even when media is hosted elsewhere', () => {
    const instagramItem = item({
      link: 'https://files.catbox.moe/story.mp4',
      title: 'inst: marcian0chka',
    });

    expect(isInstagramFeedItem(instagramItem)).toBe(true);
    expect(isShortVideoFeedItem(instagramItem)).toBe(true);
    expect(isInstagramFeedItem(item({ title: 'Instagram news' }))).toBe(false);
  });
});

describe('isVkFeedItem', () => {
  it('recognizes VK links without matching lookalike domains', () => {
    expect(isVkFeedItem(item({ link: 'https://vk.com/wall-1_2' }))).toBe(true);
    expect(isVkFeedItem(item({ link: 'https://m.vk.com/wall-1_2' }))).toBe(true);
    expect(isVkFeedItem(item({ link: 'https://vk.com.example.org/wall-1_2' }))).toBe(false);
  });
});

describe('isHltvFeedItem', () => {
  it('recognizes HLTV match pages only', () => {
    expect(isHltvFeedItem(item({
      link: 'https://www.hltv.org/matches/2396006/og-vs-spirit-event',
    }))).toBe(true);
    expect(isHltvFeedItem(item({ link: 'https://www.hltv.org/team/7020/spirit' }))).toBe(false);
    expect(isHltvFeedItem(item({
      link: 'https://example.com/matches/2396006/og-vs-spirit-event',
    }))).toBe(false);
  });
});

describe('isLiquipediaFeedItem', () => {
  it('only recognizes Liquipedia match pages', () => {
    expect(isLiquipediaFeedItem(item({
      link: 'https://liquipedia.net/dota2/Match%3AID_example',
    }))).toBe(true);
    expect(isLiquipediaFeedItem(item({
      link: 'https://liquipedia.net/dota2/The_International/2026',
    }))).toBe(false);
    expect(isLiquipediaFeedItem(item({
      link: 'https://liquipedia.net.example.org/dota2/Match:ID_example',
    }))).toBe(false);
  });
});
