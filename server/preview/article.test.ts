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
            <p>Компания Cloudflare представила открытую платформу для создания приложений и автоматизированных рабочих процессов.</p>
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
    expect(JSON.stringify(article.blocks)).not.toContain('Самое обсуждаемое');
  });
});
