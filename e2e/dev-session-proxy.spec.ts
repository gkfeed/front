import { createServer as createHttpServer, type Server } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createServer, type ViteDevServer } from 'vite';
import { expect, test } from '@playwright/test';
import { createDevApiProxy } from '../dev/apiProxy';

// Transport fixture only. This does not authenticate against the deployed API.
let upstream: Server;
let proxy: ViteDevServer;
let origin: string;
let sessionNumber = 0;

test.beforeAll(async () => {
  upstream = createHttpServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'POST') {
      const expiry = new Date(Date.now() + 3_600_000).toUTCString();
      response.setHeader('Set-Cookie', [
        `gkfeed.session=fixture-${++sessionNumber}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Expires=${expiry}`,
        'unrelated=value; Path=/; HttpOnly; Secure; SameSite=Lax',
      ]);
    } else if (request.method === 'DELETE') {
      response.setHeader('Set-Cookie', 'gkfeed.session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }
    response.end(JSON.stringify({
      origin: request.headers.origin ?? null,
      cookie: request.headers.cookie ?? null,
      authorization: request.headers.authorization ?? null,
    }));
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const upstreamPort = (upstream.address() as AddressInfo).port;
  proxy = await createServer({
    configFile: false,
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: {
      host: '127.0.0.1',
      port: 0,
      proxy: { '/api': createDevApiProxy(`http://127.0.0.1:${upstreamPort}`) },
    },
    plugins: [{
      name: 'proxy-test-page',
      configureServer(server) {
        server.middlewares.use('/__proxy_test', (_request, response) => {
          response.setHeader('Content-Type', 'text/html');
          response.end('<!doctype html><title>Cookie transport fixture</title>');
        });
      },
    }],
  });
  await proxy.listen();
  origin = `http://127.0.0.1:${(proxy.httpServer!.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await proxy?.close();
  if (upstream) await new Promise<void>((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()));
});

test('HTTP proxy stores an HttpOnly persistent cookie, restores it on reload and clears only this browser cookie', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  try {
    for (const context of [first, second]) {
      const page = await context.newPage();
      await page.goto(`${origin}/__proxy_test`);
      const loginResponse = page.waitForResponse(`${origin}/api/v2/sessions`);
      const echoed = await page.evaluate(async () => (await fetch('/api/v2/sessions', { method: 'POST' })).json());
      expect(echoed.origin).toBe(origin);
      expect(echoed.authorization).toBeNull();
      const cookies = await context.cookies(origin);
      const cookie = cookies.find((item) => item.name === 'gkfeed.session');
      expect(cookie).toMatchObject({ httpOnly: true, secure: false, sameSite: 'Lax', path: '/' });
      expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 3500);
      expect(await page.evaluate(() => document.cookie)).not.toContain('gkfeed.session');
      const headers = await (await loginResponse).allHeaders();
      expect(headers['set-cookie']).toContain('unrelated=value; Path=/; HttpOnly; Secure; SameSite=Lax');
      await page.reload();
      const restored = await page.evaluate(async () => (await fetch('/api/v2/me')).json());
      expect(restored.cookie).toContain(`gkfeed.session=${cookie!.value}`);
    }
    const [page] = first.pages();
    for (let repeat = 0; repeat < 2; repeat++) {
      await page!.evaluate(() => fetch('/api/v2/sessions/current', { method: 'DELETE' }).then(() => undefined));
      expect((await first.cookies(origin)).some((item) => item.name === 'gkfeed.session')).toBe(false);
    }
    expect((await second.cookies(origin)).some((item) => item.name === 'gkfeed.session')).toBe(true);
  } finally {
    await first.close();
    await second.close();
  }
});

test('proxy preserves missing, foreign, null and comma-separated Origins without inventing trust', async ({ request }) => {
  for (const value of [undefined, 'https://untrusted.example', 'null', `${origin}, https://untrusted.example`]) {
    const response = await request.get(`${origin}/api/v2/me`, {
      headers: value === undefined ? {} : { Origin: value },
    });
    expect((await response.json()).origin).toBe(value ?? null);
  }
});
