import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  fixture: { type: 'string', default: 'text' },
  'base-url': { type: 'string', default: 'http://127.0.0.1:4400' },
  view: { type: 'string', default: 'review' },
  output: { type: 'string' },
} });
if (!/^[a-zA-Z0-9_-]+(?:\.local)?$/.test(values.fixture)
  || !['review', 'scroll'].includes(values.view)) {
  throw new Error('Use --fixture <JSON filename without extension> and --view review|scroll.');
}
const base = new URL(values['base-url']);
if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Base URL must use HTTP(S).');
const route = new URL(`/__verify/${values.fixture}/reader?view=${values.view}`, base).href;
const output = path.resolve(values.output ?? path.join('.verification',
  `${new Date().toISOString().replaceAll(':', '-')}-${values.fixture}-${values.view}`));
await mkdir(output, { recursive: true });
const fingerprint = createHash('sha256').update(execFileSync('git', ['diff', '--binary', 'HEAD']));
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of untracked) fingerprint.update(file).update(await readFile(file));
// Custom local fixtures are ignored by Git but still affect the rendered result.
fingerprint.update(await readFile(path.join('dev/reader-fixtures', `${values.fixture}.json`)));
const report = {
  fixture: values.fixture, route, createdAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  changes: execFileSync('git', ['status', '--short'], { encoding: 'utf8' }).trim(),
  worktreeFingerprint: fingerprint.digest('hex'),
  status: 'captured', visualReview: 'required', viewports: [],
};
const browser = await chromium.launch();
try {
  for (const [name, width, height] of [['desktop-2k', 2560, 1440], ['laptop', 1366, 768], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: 'light', locale: 'en-US' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const evidence = { name, width, height, errors: [], screenshots: [] };
    page.on('pageerror', (error) => evidence.errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') evidence.errors.push(message.text());
    });
    page.on('requestfailed', (request) => evidence.errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    await page.route('**/*', (requestRoute) => {
      const url = new URL(requestRoute.request().url());
      if (url.origin !== base.origin) {
        evidence.errors.push(`External resource is not mocked: ${url.href}`);
        return requestRoute.abort();
      }
      return requestRoute.continue();
    });
    try {
      await page.goto(route);
      await page.locator('.reader-card').first().waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForFunction(() => !document.querySelector('.reader-card--preview-pending'));
      await page.waitForFunction(() => [...document.querySelectorAll('.reader-card img')]
        .every((image) => image.complete && image.naturalWidth > 0));
      await page.waitForFunction(() => [...document.querySelectorAll('.reader-card video')]
        .every((video) => video.readyState >= 2 && video.videoWidth > 0));
      await page.evaluate(() => document.querySelectorAll('video').forEach((video) => {
        video.pause();
        video.currentTime = 0;
      }));
      await page.waitForFunction(() => [...document.querySelectorAll('video')]
        .every((video) => !video.seeking && video.currentTime === 0));
      evidence.initialAutoFullscreen = await page.evaluate(() => document.querySelector('main')?.dataset.readerFullscreen === 'true');
      if (evidence.initialAutoFullscreen) {
        await page.locator('main').getByRole('button', { name: 'Exit Reader fullscreen', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('main')?.dataset.readerFullscreen !== 'true');
      }
      evidence.diagnostics = await page.evaluate(() => ({
        fixture: window.__readerFixture,
        viewport: { width: innerWidth, height: innerHeight },
        cardText: document.querySelector('.reader-card')?.textContent,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      }));
      if (evidence.diagnostics.viewport.width !== width || evidence.diagnostics.viewport.height !== height) {
        evidence.errors.push('Measured viewport differs from the requested CSS size.');
      }
      if (evidence.diagnostics.fixture?.name !== values.fixture
        || evidence.diagnostics.fixture?.blockedRequests.length) {
        evidence.errors.push('Fixture identity mismatch or unmocked requests.');
      }
      if (evidence.diagnostics.horizontalOverflow) evidence.errors.push('Document has horizontal overflow.');
      const normalPath = path.join(output, `${name}-${values.view}.png`);
      await page.screenshot({ path: normalPath, fullPage: true, animations: 'disabled' });
      evidence.screenshots.push(normalPath);
      if (values.view === 'review') {
        await page.locator('nav').getByRole('button', { name: 'Open Reader fullscreen', exact: true }).click();
        await page.locator('main[data-reader-fullscreen="true"]').waitFor();
        const fullscreenPath = path.join(output, `${name}-fullscreen.png`);
        await page.screenshot({ path: fullscreenPath, animations: 'disabled' });
        evidence.screenshots.push(fullscreenPath);
        await page.locator('main').getByRole('button', { name: 'Exit Reader fullscreen', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('main')?.dataset.readerFullscreen !== 'true');
      }
      await writeFile(path.join(output, `${name}-page.txt`), await page.locator('body').innerText());
      evidence.diagnostics.fixture = await page.evaluate(() => window.__readerFixture);
      if (evidence.diagnostics.fixture.blockedRequests.length) evidence.errors.push('Unmocked requests occurred during interaction.');
    } catch (error) {
      evidence.errors.push(error.message);
      const failurePath = path.join(output, `${name}-failure.png`);
      await page.screenshot({ path: failurePath }).then(() => evidence.screenshots.push(failurePath)).catch(() => {});
    } finally {
      report.viewports.push(evidence);
      await context.close();
    }
  }
} finally {
  await browser.close();
  if (report.viewports.length !== 3 || report.viewports.some((evidence) => evidence.errors.length)) report.status = 'failed';
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`Evidence: ${output}\nSmoke checks: ${report.status}. Open the PNGs for visual review.`);
if (report.status === 'failed') process.exitCode = 1;
