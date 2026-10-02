import { describe, expect, it } from 'vitest';

import { parseYoutubeTimecodes } from './youtubeTimecodes.js';

describe('parseYoutubeTimecodes', () => {
  it('extracts and orders chapter markers from the player response', () => {
    expect(parseYoutubeTimecodes({ markersMap: [{ value: { chapters: [
      { chapterRenderer: {
        title: { simpleText: 'Main topic' },
        timeRangeStartMillis: 270_000,
        thumbnail: { thumbnails: [{ url: '//i.ytimg.com/main.jpg' }] },
      } },
      { chapterRenderer: {
        title: { runs: [{ text: 'Introduction' }] },
        timeRangeStartMillis: '0',
      } },
    ] } }] })).toEqual([
      { title: 'Introduction', seconds: 0, thumbnailUrl: null },
      { title: 'Main topic', seconds: 270, thumbnailUrl: 'https://i.ytimg.com/main.jpg' },
    ]);
  });

  it('supports the macro marker format and ignores malformed markers', () => {
    expect(parseYoutubeTimecodes({ contents: [
      { macroMarkersListItemRenderer: {
        title: { simpleText: 'Highlights' },
        timeDescription: { simpleText: '1:02:03' },
      } },
      { macroMarkersListItemRenderer: {
        title: { simpleText: 'Broken' },
        timeDescription: { simpleText: '1:99' },
      } },
    ] })).toEqual([{ title: 'Highlights', seconds: 3723, thumbnailUrl: null }]);
  });
});
