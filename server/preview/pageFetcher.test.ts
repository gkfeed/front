import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchPublicResponse = vi.hoisted(() => vi.fn());

vi.mock('./remoteHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./remoteHttp.js')>(),
  fetchPublicResponse,
}));

import { fetchHtml } from './pageFetcher.js';

beforeEach(() => {
  fetchPublicResponse.mockReset();
});

describe('fetchHtml', () => {
  it('uses the response charset when decoding page text', async () => {
    const prefix = Buffer.from('<html><head><meta property="og:description" content="');
    const description = Uint8Array.from([0xCF, 0xF0, 0xE8, 0xE2, 0xE5, 0xF2, 0x20, 0xEC, 0xE8, 0xF0]);
    const suffix = Buffer.from('"></head><body></body></html>');
    fetchPublicResponse.mockResolvedValue({
      body: Readable.from([Buffer.concat([prefix, description, suffix])]),
      headers: { 'content-type': 'text/html; charset=windows-1251' },
      status: 200,
      url: new URL('https://vk.com/wall-1_2'),
    });

    await expect(fetchHtml(new URL('https://vk.com/wall-1_2'), undefined, { metadataOnly: true }))
      .resolves.toMatchObject({
        html: '<html><head><meta property="og:description" content="Привет мир"></head>',
      });
  });

});
