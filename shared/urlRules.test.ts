import { describe, expect, it } from 'vitest';

import {
  getMatreshkaVideoIdFromUrl,
  getSasflixPublicationIdFromUrl,
  isHltvMatchUrl,
  isInstagramMediaUrl,
  isLiquipediaMatchUrl,
  isOneFootballMatchUrl,
  isRedditVideoUrl,
  isTikTokVideoUrl,
  isVkHost,
} from './urlRules.js';

const url = (value: string) => new URL(value);

describe('shared URL rules', () => {
  it.each([
    'https://www.tiktok.com/@creator/video/123',
    'https://m.tiktok.com/v/123',
    'http://tiktok.com/v/123/',
  ])('recognizes TikTok video URL %s', (value) => {
    expect(isTikTokVideoUrl(url(value))).toBe(true);
  });

  it.each([
    'https://tiktok.com.example.org/video/123',
    'https://tiktok.com/video/123abc',
    'ftp://tiktok.com/video/123',
    'https://tiktok.com/@creator/post/123',
  ])('rejects non-video TikTok URL %s', (value) => {
    expect(isTikTokVideoUrl(url(value))).toBe(false);
  });

  it.each([
    'https://v.redd.it/abc123',
    'https://v.redd.it/abc123/DASH_720.mp4?source=fallback',
  ])('recognizes Reddit video URL %s', (value) => {
    expect(isRedditVideoUrl(url(value))).toBe(true);
  });

  it.each([
    'https://v.redd.it.example.org/abc123',
    'https://v.redd.it/abc123/DASHPlaylist.mpd',
    'ftp://v.redd.it/abc123',
    'https://i.redd.it/abc123.jpg',
  ])('rejects non-video Reddit URL %s', (value) => {
    expect(isRedditVideoUrl(url(value))).toBe(false);
  });

  it.each([
    ['https://www.hltv.org/matches/2396006/match', true],
    ['https://www.hltv.org/team/7020/spirit', false],
    ['https://hltv.org.example.org/matches/2396006/match', false],
    ['https://m.hltv.org/matches/2396006/match', false],
  ])('keeps HLTV match URL boundaries for %s', (value, expected) => {
    expect(isHltvMatchUrl(url(value))).toBe(expected);
  });

  it.each([
    ['https://onefootball.com/en/match/2700208', true],
    ['https://www.onefootball.com/de/spiel/2700208', true],
    ['https://onefootball.com/en/team/barcelona-5', false],
    ['https://onefootball.com.example.org/en/match/2700208', false],
  ])('keeps OneFootball match URL boundaries for %s', (value, expected) => {
    expect(isOneFootballMatchUrl(url(value))).toBe(expected);
  });

  it.each([
    ['https://liquipedia.net/dota2/Match%3AID_example', true],
    ['https://liquipedia.net/dota2/Match:ID_example', true],
    ['https://liquipedia.net/dota2/The_International/2026', false],
    ['https://liquipedia.net.example.org/dota2/Match:ID_example', false],
  ])('keeps Liquipedia match URL boundaries for %s', (value, expected) => {
    expect(isLiquipediaMatchUrl(url(value))).toBe(expected);
  });

  it.each([
    ['vk.com', true],
    ['m.vk.com', true],
    ['vkvideo.ru', true],
    ['vk.com.example.org', false],
  ])('keeps VK host boundaries for %s', (hostname, expected) => {
    expect(isVkHost(hostname)).toBe(expected);
  });

  it.each([
    ['https://www.instagram.com/reel/Video_123/', true],
    ['http://instagram.com/p/Post-123', true],
    ['https://user@instagram.com/p/Post123', false],
    ['https://instagram.com.example.org/p/Post123', false],
    ['https://instagram.com/profile/Post123', false],
  ])('keeps Instagram media URL boundaries for %s', (value, expected) => {
    expect(isInstagramMediaUrl(url(value))).toBe(expected);
  });

  it.each([
    ['https://matreshka.tv/video/episode_123', 'episode_123'],
    ['https://www.matreshka.tv/embed/video/episode-123/', 'episode-123'],
    ['http://matreshka.tv/video/episode', null],
    ['https://matreshka.tv.example.org/video/episode', null],
    ['https://user@matreshka.tv/video/episode', null],
  ])('extracts a bounded Matreshka video id from %s', (value, expected) => {
    expect(getMatreshkaVideoIdFromUrl(url(value))).toBe(expected);
  });

  it('extracts a Sasflix publication id through the shared rule', () => {
    expect(getSasflixPublicationIdFromUrl(url(
      'https://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea',
    ))).toBe('630ffde7-febb-4f95-a490-6208d8770dea');
    expect(getSasflixPublicationIdFromUrl(url(
      'http://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea',
    ))).toBeNull();
  });
});
