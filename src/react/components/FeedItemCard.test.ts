// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import type { FeedItem } from '../types';
import {
  analyzeFeedItem,
  getFeedItemPreview,
  isHltvFeedItem,
  isInstagramFeedItem,
  isLiquipediaFeedItem,
  isShortVideoFeedItem,
  isTikTokFeedItem,
  isVkFeedItem,
} from '../domain/feedItemPreview';

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
      alt: { kind: 'twitch', channel: 'some_channel' },
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
      alt: { kind: 'item', title: 'Story' },
    });
  });

  it('upgrades embedded VK CDN images to HTTPS', () => {
    expect(getFeedItemPreview(item({
      link: 'https://vk.com/wall-118222154_8712',
      text: '<p>Summary</p><img src="http://sun9-67.vkuserphoto.ru/impg/cover.jpg?size=1170x1560">',
    }))).toEqual({
      src: 'https://sun9-67.vkuserphoto.ru/impg/cover.jpg?size=1170x1560',
      alt: { kind: 'item', title: 'Story' },
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
      src: 'https://vk.com/video_ext.php?oid=-123&id=456&hd=2&autoplay=0&muted=0',
      type: 'embed',
    });

    expect(getFeedItemPreview(item({
      link: 'https://vk.com/wall-123_789?z=clip-123_456',
    }))).toMatchObject({
      src: 'https://vk.com/clip_ext.php?oid=-123&id=456&hd=2&autoplay=0&muted=0',
      type: 'embed',
    });

    expect(getFeedItemPreview(item({
      text: '<iframe src="https://vkvideo.ru/video_ext.php?oid=-123&amp;id=456&amp;hash=secret"></iframe>',
    }))).toMatchObject({
      src: 'https://vk.com/video_ext.php?oid=-123&id=456&hash=secret&autoplay=0&muted=0',
      type: 'embed',
    });

    expect(getFeedItemPreview(item({
      link: 'https://vk.ru/video_ext.php?oid=-123&id=456&hash=secret',
    }))).toMatchObject({
      src: 'https://vk.com/video_ext.php?oid=-123&id=456&hash=secret&autoplay=0&muted=0',
      type: 'embed',
    });
  });

  it('rejects unsafe embedded image sources', () => {
    expect(getFeedItemPreview(item({ text: '<img src="javascript:alert(1)">' }))).toBeNull();
    expect(getFeedItemPreview(item({ text: '<img src="data:text/html;base64,PHNjcmlwdD4=">' }))).toBeNull();
  });
});

describe('Twitch feed items', () => {
  it('recognizes Twitch channel links as Twitch providers', () => {
    expect(analyzeFeedItem(item({ link: 'https://www.twitch.tv/some_channel' })).provider)
      .toBe('twitch');
    expect(analyzeFeedItem(item({ link: 'https://twitch.tv.example.org/some_channel' })).provider)
      .toBe('generic');
    expect(analyzeFeedItem(item({ link: 'https://clips.twitch.tv/some_clip' })).provider)
      .toBe('generic');
    expect(analyzeFeedItem(item({ link: 'https://player.twitch.tv/some_channel' })).provider)
      .toBe('generic');
  });
});

describe('Matreshka feed items', () => {
  it('recognizes canonical and embed Matreshka video links only', () => {
    expect(analyzeFeedItem(item({
      link: 'https://matreshka.tv/video/LHAN5jgduhC',
    }))).toMatchObject({
      provider: 'matreshka',
      matreshkaVideoId: 'LHAN5jgduhC',
    });
    expect(analyzeFeedItem(item({
      link: 'https://www.matreshka.tv/embed/video/mQJAs3oSzfQ',
    })).provider).toBe('matreshka');
    expect(analyzeFeedItem(item({
      link: 'https://matreshka.tv.example.org/video/LHAN5jgduhC',
    })).provider).toBe('generic');
    expect(analyzeFeedItem(item({
      link: 'https://matreshka.tv/channel/LHAN5jgduhC',
    })).provider).toBe('generic');
    expect(analyzeFeedItem(item({
      link: 'http://matreshka.tv/video/LHAN5jgduhC',
    })).provider).toBe('generic');
    expect(analyzeFeedItem(item({
      link: 'https://user:password@matreshka.tv/video/LHAN5jgduhC',
    })).provider).toBe('generic');
  });
});

describe('isTikTokFeedItem', () => {
  it('recognizes TikTok links without matching lookalike domains', () => {
    expect(isTikTokFeedItem(item({ link: 'https://www.tiktok.com/@creator/video/123' }))).toBe(true);
    expect(isTikTokFeedItem(item({ link: 'https://m.tiktok.com/v/123' }))).toBe(true);
    expect(isTikTokFeedItem(item({ link: 'https://tiktok.com.example.org/video/123' }))).toBe(false);
  });

  it('keeps a TikTok link as TikTok when its imported title has an Instagram marker', () => {
    expect(analyzeFeedItem(item({
      link: 'https://www.tiktok.com/@creator/video/123',
      title: 'inst: milasmokesjoint',
    })).provider).toBe('tiktok');
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
