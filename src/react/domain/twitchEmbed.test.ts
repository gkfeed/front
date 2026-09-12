import { describe, expect, it } from 'vitest';

import { getTwitchChannelUrl, getTwitchEmbedUrl } from './twitchEmbed';

describe('Twitch embeds', () => {
  it('builds an embed for localhost development', () => {
    expect(getTwitchEmbedUrl('some_channel', {
      hostname: 'localhost',
      port: '4200',
      protocol: 'http:',
    })).toBe('https://player.twitch.tv/?channel=some_channel&parent=localhost&autoplay=true');
  });

  it('builds an embed for an HTTPS site on the default port', () => {
    expect(getTwitchEmbedUrl('some_channel', {
      hostname: 'reader.example.com',
      port: '',
      protocol: 'https:',
    })).toBe('https://player.twitch.tv/?channel=some_channel&parent=reader.example.com&autoplay=true');
  });

  it.each([
    { hostname: 'gkfeed.local', port: '4200', protocol: 'http:' },
    { hostname: '192.168.1.20', port: '4200', protocol: 'http:' },
    { hostname: 'reader.example.com', port: '8443', protocol: 'https:' },
  ])('rejects an origin Twitch will block: $protocol//$hostname:$port', (location) => {
    expect(getTwitchEmbedUrl('some_channel', location)).toBeNull();
  });

  it('builds a safe channel URL for the external fallback', () => {
    expect(getTwitchChannelUrl('some channel')).toBe('https://www.twitch.tv/some%20channel');
  });
});
