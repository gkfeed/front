import { describe, expect, it, vi } from 'vitest';

import { createDetachedRequestExecutionContext } from './application/requestExecutionContext.js';
import { suggestFeedType } from './feedTypeSuggestion.js';

describe('Jev feed type suggestion', () => {
  it('sends the GKFEED taxonomy to the Decisions API and parses the choice', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      model: 'typesafe/jev-1.13-20260917',
      answers: {
        feed_type: {
          type: 'choice',
          choice: 'twitch',
          confidence: 0.91,
          probabilities: { twitch: 0.95, web: 0.05 },
        },
      },
    }), { status: 200 }));

    await expect(suggestFeedType(
      { url: 'https://twitch.tv/gkfeed', title: 'My streams' },
      createDetachedRequestExecutionContext(),
      'temporary-test-key',
      fetchImplementation,
    )).resolves.toEqual({ type: 'twitch', confidence: 0.91 });

    expect(fetchImplementation).toHaveBeenCalledOnce();
    const [url, init] = fetchImplementation.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions');
    const request = JSON.parse(String(init.body));
    expect(request.model).toBe('typesafe/jev-1.13');
    expect(request.state).toEqual({
      url: 'https://twitch.tv/gkfeed',
      user_supplied_title: 'My streams',
    });
    expect(request.questions.feed_type.type).toBe('choice');
    expect(request.questions.feed_type.criteria).toMatchObject({
      web: expect.any(String),
      twitch: expect.any(String),
      yt: expect.any(String),
    });
  });

  it('rejects a choice outside the supported feed taxonomy', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      answers: {
        feed_type: { type: 'choice', choice: 'made-up', confidence: 1 },
      },
    }), { status: 200 }));

    await expect(suggestFeedType(
      { url: 'https://example.com' },
      createDetachedRequestExecutionContext(),
      'temporary-test-key',
      fetchImplementation,
    )).rejects.toThrow('invalid feed type');
  });

  it('reports missing server configuration without making a request', async () => {
    const fetchImplementation = vi.fn();
    await expect(suggestFeedType(
      { url: 'https://example.com' },
      createDetachedRequestExecutionContext(),
      '',
      fetchImplementation,
    )).rejects.toMatchObject({ status: 503, code: 'feed_type_detection_unavailable' });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
