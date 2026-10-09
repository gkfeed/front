import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const fixtureRoot = new URL('./reader-fixtures/', import.meta.url);
const contentTypes: Record<string, string> = {
  json: 'application/json',
  svg: 'image/svg+xml',
  webm: 'video/webm',
  mp4: 'video/mp4',
};

/** Fixtures and assets are served by Vite only, never copied to dist. */
export function readerFixturesPlugin(): Plugin {
  return {
    name: 'reader-verification-fixtures',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__fixtures', (request, response) => {
        const path = new URL(request.url ?? '/', 'http://localhost').pathname;
        const match = /^\/([a-zA-Z0-9_-]+(?:\.local)?\.json|assets\/[a-zA-Z0-9_-]+\.(?:svg|webm|mp4))$/.exec(path);
        if (!match || !['GET', 'HEAD'].includes(request.method ?? '')) {
          response.statusCode = 404;
          response.end('Unknown reader fixture');
          return;
        }
        void readFile(fileURLToPath(new URL(match[1]!, fixtureRoot))).then((body) => {
          response.setHeader('Content-Type', contentTypes[match[1]!.split('.').at(-1)!]!);
          response.setHeader('Cache-Control', 'no-store');
          response.end(request.method === 'HEAD' ? undefined : body);
        }).catch(() => {
          response.statusCode = 404;
          response.end('Reader fixture file not found');
        });
      });
    },
  };
}
