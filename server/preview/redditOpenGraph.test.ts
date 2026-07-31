import { describe, expect, it } from 'vitest';

import { fetchRedditPreviewImage } from './reddit.js';

describe('fetchRedditPreviewImage: provider policy', () => {
  it('only accepts generated Reddit preview image URLs', async () => {
    await expect(fetchRedditPreviewImage('https://example.com/preview/post/abc123'))
      .rejects.toMatchObject({ status: 400, code: 'invalid_reddit_preview' });
  });
});
