/* global window, document, location, getComputedStyle, innerHeight, requestAnimationFrame, indexedDB */
import { chromium } from '@playwright/test';
import { spawnSync, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import os from 'node:os';

const runs = Number(process.env.BENCH_RUNS ?? 20);
const warmups = Number(process.env.BENCH_WARMUPS ?? 2);
const slowRuns = Number(process.env.BENCH_SLOW_RUNS ?? 10);
const itemCount = Number(process.env.BENCH_ITEMS ?? 1000);
const nextCount = Number(process.env.BENCH_NEXT ?? 20);
if (![runs, slowRuns, itemCount].every((n) => Number.isSafeInteger(n) && n > 0)
  || !Number.isSafeInteger(nextCount) || nextCount < 0 || nextCount >= itemCount
  || !Number.isSafeInteger(warmups) || warmups < 0) throw new Error('Invalid benchmark configuration');
const output = resolve('.verification', `reader-benchmark-${new Date().toISOString().replaceAll(':', '-')}`);
const buildDir = resolve(output, 'build');
await mkdir(output, { recursive: true });
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', buildDir], {
  stdio: 'inherit', env: { ...process.env, VITE_API_ROOT: '/api/v1' },
});
if (build.status !== 0) throw new Error('Production build failed');
const items = Array.from({ length: itemCount }, (_, index) => ({
  id: itemCount - index, feed_id: index % 10 + 1,
  link: `https://example.com/benchmark/${itemCount - index}`,
  title: `Benchmark item ${itemCount - index}`,
  text: '<p>Deterministic reader benchmark body. The first item is ready to read.</p>',
}));
const feeds = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1, title: `Benchmark feed ${i + 1}`, type: 'rss', url: `https://example.com/feed/${i + 1}`,
}));
let latency = 0;
const unexpected = [];
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let data;
    if (url.pathname === '/api/v1/list') data = feeds;
    else if (url.pathname === '/api/v2/items/sync') {
      const offset = Number(url.searchParams.get('cursor') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 100);
      const end = Math.min(offset + limit, itemCount);
      data = { items: items.slice(offset, end), next_cursor: end < itemCount ? String(end) : '', has_more: end < itemCount, sync_cursor: 'benchmark' };
    } else if (url.pathname === '/api/v2/items/changes') {
      data = { upserted: [], deleted_ids: [], next_cursor: 'benchmark', has_more: false };
    } else if (url.pathname === '/bff/open-graph') {
      data = { url: url.searchParams.get('url'), title: null, description: null, image: null, video: null, siteName: null, type: 'article', providerData: null };
    } else if (/^\/(api|bff)\//.test(url.pathname)) {
      unexpected.push(url.pathname); res.writeHead(501).end(); return;
    }
    if (data !== undefined) {
      await new Promise((done) => setTimeout(done, latency));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data)); return;
    }
    const path = resolve(buildDir, `.${url.pathname}`);
    if (!path.startsWith(`${buildDir}/`)) { res.writeHead(403).end(); return; }
    const file = extname(path) ? path : resolve(buildDir, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch (error) { unexpected.push(String(error)); res.writeHead(500).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const baseURL = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  browser = await chromium.launch();
  for (const scenario of [
    { name: 'cold-api-0ms', latency: 0 },
    { name: 'cold-api-150ms', latency: 150 },
    { name: 'cached-api-150ms', latency: 150, cached: true },
    { name: 'spa-api-150ms', latency: 150, spa: true },
    { name: 'cold-api-3000ms', latency: 3000, runs: slowRuns },
    { name: 'cached-api-3000ms', latency: 3000, cached: true, runs: slowRuns },
    { name: 'spa-api-3000ms', latency: 3000, spa: true, runs: slowRuns },
  ].filter((s) => (!process.env.BENCH_SLOW_ONLY || s.latency === 3000)
    && (!process.env.BENCH_SCENARIOS || process.env.BENCH_SCENARIOS.split(',').includes(s.name)))) {
    const samples = [];
    const scenarioRuns = scenario.runs ?? runs;
    for (let i = -warmups; i < scenarioRuns; i++) {
      latency = scenario.latency;
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'en-US', serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await context.route('**/*', (route) => new URL(route.request().url()).origin === baseURL
        ? route.continue() : (errors.push(`External request: ${route.request().url()}`), route.abort()));
      await page.addInitScript(({ itemCount, nextCount }) => {
        localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'reader-benchmark', password: 'synthetic' }));
        const state = window.__readerBench = { start: location.pathname === '/reader' ? 0 : null, result: null, step: 0, stepStart: null, done: false, error: null };
        document.addEventListener('click', (event) => {
          if (event.target.closest?.('a[href="/reader"]')) state.start = performance.now();
        }, true);
        const visible = (element) => {
          if (!element) return false;
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight
            && style.visibility === 'visible' && Number(style.opacity) > 0;
        };
        const seenIds = new Set([itemCount]);
        let previousId = null;
        let currentId = null;
        const ready = () => {
          const card = document.querySelector('.reader-card');
          if (!visible(card)) return false;
          const heading = [...card.querySelectorAll('h2,h3')].find((h) => /^Benchmark item \d+$/.test(h.textContent) && visible(h));
          if (!heading) return false;
          const id = Number(heading.textContent.replace('Benchmark item ', ''));
          if (state.step === 0 ? id !== itemCount : id === previousId) return false;
          currentId = id;
          return true;
        };
        let candidate = null;
        let firstVisibleAt;
        function finish(completed, blocked = null) {
          const next = state.result.nextItems;
          next.completed = completed;
          next.completedCount = next.transitions.length;
          next.blocked = blocked;
          next.uniqueNewItems = seenIds.size - 1;
          next.repeatedItems = next.transitions.filter((t) => t.repeated).length;
          next.totalWaitMs = next.transitions.reduce((sum, t) => sum + t.clickToVisibleMs, 0);
          next.elapsedFromFirstMs = performance.now() - firstVisibleAt;
          next.fromOpenMs = performance.now() - state.start;
          state.done = true;
        }
        function tick() {
          const now = performance.now();
          if (state.stepStart !== null && now - state.stepStart > 15000) {
            finish(false, { position: state.step, fromId: previousId, waitedMs: now - state.stepStart });
            return;
          }
          if (state.start !== null && ready()) {
            if (candidate !== null) {
              if (state.step === 0) {
                firstVisibleAt = now;
                state.result = {
                  firstItemMs: now - state.start,
                  domReadyMs: candidate - state.start,
                  resources: performance.getEntriesByType('resource').filter((r) => /\/(api|bff)\//.test(r.name)).map((r) => ({ path: new URL(r.name).pathname + new URL(r.name).search, startMs: r.startTime - state.start, endMs: r.responseEnd - state.start })),
                  nextItems: { action: 'keep', count: nextCount, transitions: [] },
                };
              } else {
                state.result.nextItems.transitions.push({
                  position: state.step, fromId: previousId, toId: currentId, repeated: seenIds.has(currentId),
                  clickToVisibleMs: now - state.stepStart,
                  elapsedFromFirstMs: now - firstVisibleAt,
                });
                seenIds.add(currentId);
              }
              if (state.step === nextCount) {
                finish(true);
                return;
              }
              const keep = document.querySelector('.reader__actions .reader__keep');
              if (!keep || keep.disabled || !visible(keep)) {
                state.error = 'Visible, enabled Keep button was not found';
                return;
              }
              candidate = null;
              previousId = currentId;
              state.step += 1;
              state.stepStart = performance.now();
              // Run the actual React click handler without adding automation round trips or dwell time.
              keep.click();
              requestAnimationFrame(tick);
              return;
            }
            candidate = now;
          } else candidate = null;
          requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }, { itemCount, nextCount });
      if (scenario.cached || scenario.spa) {
        await page.goto(`${baseURL}/settings`);
        await page.getByRole('link', { name: 'Reader', exact: true }).waitFor();
        // Finish session restoration before timing a click in an already open app.
        await page.waitForFunction(() => performance.getEntriesByType('resource').some((r) => new URL(r.name).pathname === '/api/v1/list' && r.responseEnd > 0));
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      }
      if (scenario.cached) {
        await page.evaluate(async (rawItems) => {
          await new Promise((done, fail) => {
            const request = indexedDB.open('gkfeed-cache', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('feed-items', { keyPath: 'username' });
            request.onerror = () => fail(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction('feed-items', 'readwrite');
              tx.objectStore('feed-items').put({ username: 'reader-benchmark', savedAt: Date.now(), cursor: 'benchmark', items: rawItems.map(({ feed_id, ...item }) => ({ ...item, feedId: feed_id })) });
              tx.oncomplete = () => { db.close(); done(); };
              tx.onerror = () => fail(tx.error);
            };
          });
        }, items);
      }
      if (scenario.spa) await page.getByRole('link', { name: 'Reader', exact: true }).click();
      else await page.goto(`${baseURL}/reader?view=review`, { waitUntil: 'domcontentloaded' });
      try {
        await page.waitForFunction(() => window.__readerBench.result !== null || window.__readerBench.error, null, { timeout: 15000 });
        await page.waitForFunction(() => window.__readerBench.done || window.__readerBench.error, null, { timeout: Math.max(15000, nextCount * 15000) });
        const measurementError = await page.evaluate(() => window.__readerBench.error);
        if (measurementError) throw new Error(measurementError);
      } catch (error) {
        await page.screenshot({ path: resolve(output, 'failure.png') });
        await writeFile(resolve(output, 'failure.json'), JSON.stringify({ errors, unexpected, body: await page.locator('body').innerText(), state: await page.evaluate(() => window.__readerBench) }, null, 2));
        throw error;
      }
      const sample = await page.evaluate(() => window.__readerBench.result);
      if (errors.length || unexpected.length) throw new Error(JSON.stringify({ errors, unexpected }));
      if (i >= 0) {
        samples.push(sample);
        if (scenario.latency >= 1000) console.log(`${scenario.name} ${i + 1}/${scenarioRuns}: ${sample.firstItemMs.toFixed(1)} ms`);
      }
      if (i === scenarioRuns - 1) await page.screenshot({ path: resolve(output, `${scenario.name}.png`) });
      await context.close();
    }
    const times = samples.map((s) => s.firstItemMs).sort((a, b) => a - b);
    const quantile = (q) => times[Math.ceil(times.length * q) - 1];
    const summarize = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return { medianMs: sorted[Math.ceil(sorted.length * 0.5) - 1] ?? null, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null, maxMs: sorted.at(-1) ?? null };
    };
    const nextItems = {
      count: nextCount, action: 'keep',
      completedSeries: samples.filter((s) => s.nextItems.completed).length,
      blockedSeries: samples.filter((s) => !s.nextItems.completed).length,
      uniqueNewItems: { min: Math.min(...samples.map((s) => s.nextItems.uniqueNewItems)), max: Math.max(...samples.map((s) => s.nextItems.uniqueNewItems)) },
      repeatedItems: samples.reduce((sum, s) => sum + s.nextItems.repeatedItems, 0),
      transitions: summarize(samples.flatMap((s) => s.nextItems.transitions.map((t) => t.clickToVisibleMs))),
      totalWait: summarize(samples.filter((s) => s.nextItems.completed).map((s) => s.nextItems.totalWaitMs)),
      perPosition: Array.from({ length: nextCount }, (_, index) => ({ position: index + 1, ...summarize(samples.flatMap((s) => s.nextItems.transitions[index] ? [s.nextItems.transitions[index].clickToVisibleMs] : [])) })),
    };
    const result = { nextItems, ...scenario, runs: scenarioRuns, medianMs: quantile(0.5), p95Ms: quantile(0.95), minMs: times[0], maxMs: times.at(-1), samples };
    results.push(result);
    await writeFile(resolve(output, `${scenario.name}.json`), `${JSON.stringify(result, null, 2)}\n`);
    console.log(`${scenario.name}: median ${result.medianMs.toFixed(1)} ms, p95 ${result.p95Ms.toFixed(1)} ms; next ${nextCount}: median ${nextItems.transitions.medianMs?.toFixed(1) ?? 'n/a'} ms, p95 ${nextItems.transitions.p95Ms?.toFixed(1) ?? 'n/a'} ms, series ${nextItems.totalWait.medianMs?.toFixed(1) ?? 'incomplete'} ms`);
  }
  const report = {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    workingTree: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }),
    measuredAt: new Date().toISOString(), node: process.version, chromium: browser.version(),
    platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
    viewport: { width: 1366, height: 768 }, itemCount, nextCount, warmups, cpuThrottling: 'none', httpCache: 'disabled by Playwright request routing', apiLatency: 'fixed server delay per API/BFF response; static assets on localhost',
    metric: 'Navigation start or captured Reader click to visible first card and its title, confirmed across two animation frames. Approximation of paint. No explicit wait for media/preview readiness; the UI may gate its title on preview completion.',
    nextMetric: 'Keep click to the expected next different visible card and title across two animation frames. Repeated previously seen IDs are recorded, not treated as new unique items. No dwell time; prefetch and background sync remain active. Series total is reported only for completed series. Transitions blocked for 15 seconds are censored and recorded separately, never treated as completed fast transitions.',
    results,
  };
  await writeFile(resolve(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(output, 'results.md'), [
    '# Reader first item', '',
    `Revision: ${report.revision}. Chromium ${report.chromium}. Items: ${itemCount}.`, '',
    '| Scenario | Samples | Median, ms | p95, ms |',
    '| --- | ---: | ---: | ---: |',
    ...results.map((r) => `| ${r.name} | ${r.runs} | ${r.medianMs.toFixed(1)} | ${r.p95Ms.toFixed(1)} |`),
    '', report.metric, '',
    `Next ${nextCount} items via Keep, no dwell time.`, '',
    '| Scenario | Transition median, ms | Transition p95, ms | Worst transition, ms | Series median, ms | Unique new items per series | Repeats across runs | Completed series |',
    '| --- | ---: | ---: | ---: | ---: | --- | ---: | --- |',
    ...results.map((r) => `| ${r.name} | ${r.nextItems.transitions.medianMs?.toFixed(1) ?? 'n/a'} | ${r.nextItems.transitions.p95Ms?.toFixed(1) ?? 'n/a'} | ${r.nextItems.transitions.maxMs?.toFixed(1) ?? 'n/a'} | ${r.nextItems.totalWait.medianMs?.toFixed(1) ?? 'incomplete'} | ${r.nextItems.uniqueNewItems.min} to ${r.nextItems.uniqueNewItems.max} | ${r.nextItems.repeatedItems} | ${r.nextItems.completedSeries}/${r.runs} |`),
    '', report.nextMetric, '',
  ].join('\n'));
  console.log(`Report: ${output}/results.json`);
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(buildDir, { recursive: true, force: true });
}
