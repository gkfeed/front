import { describe, expect, it, vi } from 'vitest';

import { createDetachedRequestExecutionContext } from '../application/requestExecutionContext.js';
import { fetchHtml } from './pageFetcher.js';
import { fetchArticle } from './article.js';

vi.mock('./pageFetcher.js', () => ({ fetchHtml: vi.fn() }));

describe('fetchArticle', () => {
  it('extracts readable Trashbox-style content into safe structured blocks', async () => {
    vi.mocked(fetchHtml).mockResolvedValue({
      url: new URL('https://trashbox.ru/link/cloudflare-os'),
      html: `<!doctype html><html><head>
        <title>Cloudflare OS</title>
        <meta name="author" content="Svidetel">
      </head><body>
        <nav>Новости Смартфоны Игры</nav>
        <article>
          <h1>Представлена Cloudflare OS</h1>
          <div id="div_text_content_214110">
            <p>Компания Cloudflare представила открытую платформу для создания приложений и автоматизированных рабочих процессов.
              <img src="/images/inline.webp" alt="Встроенная иллюстрация">
            </p>
            <h2>Возможности платформы</h2>
            <ul><li>Создание документов</li><li>Автоматизация задач</li></ul>
            <img src="/images/cloudflare.webp" alt="Интерфейс Cloudflare OS" width="1200" height="675">
            <p>Исходный код опубликован на GitHub и доступен разработчикам для свободного использования и модификации.</p>
          </div>
        </article>
        <aside>Самое обсуждаемое сегодня</aside>
      </body></html>`,
    });

    const article = await fetchArticle(
      'https://trashbox.ru/link/cloudflare-os',
      createDetachedRequestExecutionContext(),
    );

    expect(article).toMatchObject({
      url: 'https://trashbox.ru/link/cloudflare-os',
      title: 'Cloudflare OS',
      byline: 'Svidetel',
    });
    expect(article.blocks).toContainEqual({
      type: 'list',
      ordered: false,
      items: ['Создание документов', 'Автоматизация задач'],
    });
    expect(article.blocks).toContainEqual({
      type: 'image',
      src: 'https://trashbox.ru/images/cloudflare.webp',
      alt: 'Интерфейс Cloudflare OS',
    });
    expect(article.blocks).toContainEqual({
      type: 'image',
      src: 'https://trashbox.ru/images/inline.webp',
      alt: 'Встроенная иллюстрация',
    });
    expect(JSON.stringify(article.blocks)).not.toContain('Самое обсуждаемое');
  });

  it('drops image URLs that could target the reader local network', async () => {
    vi.mocked(fetchHtml).mockResolvedValue({
      url: new URL('https://example.com/article'),
      html: `<!doctype html><html><head><title>Safe article</title></head><body>
        <article>
          <p>This article contains enough readable text for the preview response to be accepted.
            It also has more explanatory prose so Readability does not reject the fixture.
            <img src="http://192.168.1.1/admin" alt="Router">
            <img src="http://localhost/status" alt="Local service">
            <img src="https://cdn.example.com/public.jpg" alt="Public image">
          </p>
        </article>
      </body></html>`,
    });

    const article = await fetchArticle(
      'https://example.com/article',
      createDetachedRequestExecutionContext(),
    );

    expect(article.blocks).toContainEqual({
      type: 'image',
      src: 'https://cdn.example.com/public.jpg',
      alt: 'Public image',
    });
    expect(JSON.stringify(article.blocks)).not.toContain('192.168.1.1');
    expect(JSON.stringify(article.blocks)).not.toContain('localhost');
  });
});
