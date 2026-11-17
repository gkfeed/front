import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ArticlePreview } from '../shared/articleContracts.js';
import { createDetachedRequestExecutionContext } from './application/requestExecutionContext.js';
import { requireArticleSummaryKey, summarizeArticle } from './articleSummary.js';

const article: ArticlePreview = {
  url: 'https://example.com/story', title: 'Wirtschaft', byline: null, excerpt: null,
  blocks: [
    { type: 'paragraph', text: 'Wachstum um 1,3 Prozent.' },
    { type: 'image', src: 'https://example.com/image.jpg', alt: 'Port' },
    { type: 'list', items: ['Industrie wächst.'], ordered: false },
  ],
};
const context = createDetachedRequestExecutionContext();
const response = (content: unknown, finish_reason = 'stop') => new Response(JSON.stringify({
  choices: [{ finish_reason, message: { content: JSON.stringify(content) } }],
}));
afterEach(() => vi.unstubAllEnvs());

describe('article summaries', () => {
  it('sends extracted text to OpenRouter and joins 2 Russian sentences', async () => {
    vi.stubEnv('OPENROUTER_SUMMARY_MODEL', 'test/model');
    const fetcher = vi.fn().mockResolvedValue(response({ sentences: ['Рост составит 1,3%.', 'Промышленность растёт.'] }));
    await expect(summarizeArticle(article, context, 'test-key', fetcher)).resolves.toEqual({
      summary: 'Рост составит 1,3%. Промышленность растёт.',
    });
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers).toMatchObject({ authorization: 'Bearer test-key' });
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('test/model');
    expect(body.messages[0].content).toContain('2–3 предложениях');
    expect(JSON.parse(body.messages[1].content)).toEqual({ title: 'Wirtschaft', text: 'Wachstum um 1,3 Prozent.\nIndustrie wächst.' });
  });

  it('uses the requested DeepSeek model by default', async () => {
    vi.stubEnv('OPENROUTER_SUMMARY_MODEL', '');
    const fetcher = vi.fn().mockResolvedValue(response({ sentences: ['Первое предложение.', 'Второе предложение.'] }));
    await summarizeArticle(article, context, 'key', fetcher);
    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).model).toBe('deepseek/deepseek-v4.1-flash-1017');
  });

  it('accepts multiple sentences returned in one array element', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ sentences: ['Рост составит 1,3%. Промышленность растёт.'] }));
    await expect(summarizeArticle(article, context, 'key', fetcher)).resolves.toEqual({
      summary: 'Рост составит 1,3%. Промышленность растёт.',
    });
  });

  it.each([
    { sentences: ['Одно предложение.'] },
    { sentences: ['One sentence.', 'Another sentence.'] },
    { sentences: ['Раз.', 'Два.', 'Три.', 'Четыре.'] },
    { sentences: ['Раз. Два. Три. Четыре.'] },
    { summary: 'Неверный формат.' },
  ])('rejects invalid output: %j', async (output) => {
    await expect(summarizeArticle(article, context, 'key', vi.fn().mockResolvedValue(response(output))))
      .rejects.toThrow('invalid Russian summary');
  });

  it('rejects truncated completions and upstream errors', async () => {
    await expect(summarizeArticle(article, context, 'key', vi.fn().mockResolvedValue(response({}, 'length'))))
      .rejects.toThrow('incomplete');
    await expect(summarizeArticle(article, context, 'key', vi.fn().mockResolvedValue(new Response('', { status: 429 }))))
      .rejects.toThrow('HTTP 429');
  });

  it('rejects empty articles before calling the model', async () => {
    const fetcher = vi.fn();
    await expect(summarizeArticle({ ...article, blocks: [article.blocks[1]!] }, context, 'key', fetcher))
      .rejects.toMatchObject({ status: 422 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports missing server configuration', () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    expect(requireArticleSummaryKey).toThrow('not configured');
  });
});
