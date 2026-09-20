import { describe, expect, it } from 'vitest';

import { parseYoutubeOEmbed } from './providers/youtube.js';

describe('YouTube oEmbed preview', () => {
  it('keeps the title returned by YouTube unchanged', () => {
    expect(parseYoutubeOEmbed({
      title: 'ПЯТЕРКА ДАЛ ФЛЕШУ ВТОРОЙ ШАНС!',
      thumbnail_url: 'https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg',
    }, new URL('https://www.youtube.com/watch?v=abc123xyz'))).toMatchObject({
      title: 'ПЯТЕРКА ДАЛ ФЛЕШУ ВТОРОЙ ШАНС!',
      image: 'https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg',
      siteName: 'YouTube',
      type: 'video',
    });
  });

  it('rejects incomplete metadata and non-video pages', () => {
    expect(parseYoutubeOEmbed({}, new URL('https://youtu.be/abc123xyz'))).toBeNull();
    expect(parseYoutubeOEmbed(
      { title: 'Channel' },
      new URL('https://www.youtube.com/@example'),
    )).toBeNull();
  });
});
