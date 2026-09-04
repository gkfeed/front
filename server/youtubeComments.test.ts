import { describe, expect, it } from 'vitest';

import { parseYoutubeComments } from './youtubeComments.js';

describe('parseYoutubeComments', () => {
  it('extracts public comment fields from YouTube renderers', () => {
    expect(parseYoutubeComments({ nested: [{ commentRenderer: {
      commentId: 'comment-1',
      contentText: { runs: [{ text: 'Great ' }, { text: 'video' }] },
      authorText: { simpleText: 'Viewer' },
      authorThumbnail: { thumbnails: [{ url: 'https://example.com/avatar.jpg' }] },
      publishedTimeText: { runs: [{ text: '2 hours ago' }] },
      voteCount: { simpleText: '12' },
    } }] })).toEqual([{
      id: 'comment-1',
      text: 'Great video',
      author: 'Viewer',
      avatarUrl: 'https://example.com/avatar.jpg',
      publishedTime: '2 hours ago',
      likeCount: '12',
    }]);
  });

  it('ignores malformed comment renderers', () => {
    expect(parseYoutubeComments({ commentRenderer: { commentId: 'missing-copy' } })).toEqual([]);
  });

  it('extracts comments from the current entity payload format', () => {
    expect(parseYoutubeComments({ commentEntityPayload: {
      properties: {
        commentId: 'comment-2',
        content: { content: 'Entity comment' },
        publishedTime: '1 day ago',
      },
      author: { displayName: '@Viewer', avatarThumbnailUrl: 'https://example.com/viewer.jpg' },
      toolbar: { likeCountNotliked: '42' },
    } })).toEqual([{
      id: 'comment-2',
      text: 'Entity comment',
      author: '@Viewer',
      avatarUrl: 'https://example.com/viewer.jpg',
      publishedTime: '1 day ago',
      likeCount: '42',
    }]);
  });
});
