// Reproduce the PR demo without a server or production credentials.
// Usage: node scripts/demo-story-loading.mjs [before-revision]
// Requires ffmpeg and `npx playwright install chromium`.
/* global document, window */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { rolldown } from 'rolldown';

const root = fileURLToPath(new URL('..', import.meta.url));
const baseline = process.argv[2] ?? '5a212ab';
const out = path.join(root, 'test-results/story-demo');
await mkdir(out, { recursive: true });
const fromGit = (file) => execFileSync('git', ['show', `${baseline}:${file}`], { cwd: root, encoding: 'utf8' });
const source = async (file, before) => before ? fromGit(file) : readFile(path.join(root, file), 'utf8');

// Synthetic, silent clips. Their 2:3 shape also exercises the old metadata
// resize inside the 9:16 story frame. Both panes receive identical bytes.
for (const [id, color] of [[1, '#365f95'], [2, '#416b55']]) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i',
    `color=c=${color}:s=360x540:r=15:d=6`, '-vf',
    `drawgrid=w=60:h=60:t=1:c=white@0.12,drawtext=text='STORY 0${id}':fontcolor=white:fontsize=38:x=(w-tw)/2:y=220,drawtext=text='TEST CLIP':fontcolor=white@0.6:fontsize=18:x=(w-tw)/2:y=280`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, `${id}.mp4`)]);
}

const changedModules = [
  'src/react/components/previews/FeedItemVideoMedia.tsx',
  'src/react/hooks/useReviewPreviewPrefetch.ts',
];
async function bundle(before) {
  const variant = before ? 'before' : 'after';
  const entry = path.join(root, `node_modules/.cache/story-demo-${variant}.tsx`);
  const entrySource = `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import i18next from 'i18next';
    import { initReactI18next } from 'react-i18next';
    import { FeedItemVideoMedia } from '${root}/src/react/components/previews/FeedItemVideoMedia';
    import { useReviewPreviewPrefetch } from '${root}/src/react/hooks/useReviewPreviewPrefetch';
    import { FeatureUseCasesContext } from '${root}/src/react/state/featureUseCasesContext';
    i18next.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: {} } } });
    const items = [1, 2].map(id => ({ id, feedId: 1, title: 'inst: demo', text: '',
      link: 'https://story-demo.invalid/${variant}/' + id + '.mp4' }));
    const useCases = { preview: { loadRemotePreview: async () => ({ openGraphPreview: null, liquipediaMatch: null }) } };
    function Demo() {
      const [index, setIndex] = useState(0);
      useReviewPreviewPrefetch({ enabled: true, items, activeReviewIds: items.slice(index).map(item => item.id) });
      window.nextStory = () => setIndex(1);
      return <div className="reader__item reader__item--short-video">
        <article className="reader-card reader-card--short-video reader-card--instagram">
          <FeedItemVideoMedia key={index} preview={{ src: items[index].link, type: 'video', alt: 'Demo story' }}
            isShortVideo isTikTok={false} onPreviewError={() => { window.mediaError = true; }}
            soundGesture={{ isMuted: true, showPrompt: false, enableSound: () => {} }}
            overlay={<div className="reader-card__short-video-identity">demo · {index + 1}/2</div>} />
        </article>
      </div>;
    }
    createRoot(document.getElementById('root')).render(<FeatureUseCasesContext value={useCases}><Demo /></FeatureUseCasesContext>);
  `;
  const build = await rolldown({
    input: entry,
    transform: { jsx: 'react-jsx', define: {
      'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env': '{}',
    } },
    plugins: [{
      name: 'demo-sources',
      resolveId(id) {
        if (id === entry) return entry;
      },
      load(id) {
        if (id === entry) return entrySource;
        const file = path.relative(root, id);
        if (before && changedModules.includes(file)) return fromGit(file);
      },
    }],
  });
  try {
    const { output } = await build.generate({ format: 'iife' });
    return output.find(item => item.type === 'chunk').code;
  } finally {
    await build.close();
  }
}
const styles = async (before) => (await Promise.all([
  'src/styles/reader/card.css', 'src/styles/reader/card-media.css',
  'src/styles/reader/short-video/base.css',
].map(file => source(file, before)))).join('\n');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage({ viewport: { width: 760, height: 800 }, deviceScaleFactor: 1 });
  const responses = new Set();
  const requests = [];
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  // Controlled cold response per URL. Subsequent requests use this fixture's
  // in-memory response cache; this is a demonstration, not a cache benchmark.
  await page.route('https://story-demo.invalid/**', async route => {
    const url = route.request().url();
    requests.push(url);
    if (!responses.has(url)) await delay(1200);
    responses.add(url);
    const id = url.endsWith('/1.mp4') ? 1 : 2;
    await route.fulfill({ contentType: 'video/mp4', body: await readFile(path.join(out, `${id}.mp4`)) });
  });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:20px;background:#10131b;color:#edf0f7;font:16px system-ui}
    header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px}
    header small{color:#aeb8cb;font-size:12px}.panes{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    section{background:#1b202c;border:1px solid #323b4f;border-radius:16px;overflow:hidden}
    h2{margin:0;padding:14px 18px;font-size:20px}iframe{display:block;border:0;width:100%;height:540px}
    p{font-size:13px;color:#bdc8dc;margin:0;padding:0 18px 16px;height:50px}
    footer{margin-top:14px;color:#aeb8cb;font-size:12px}#phase{font-size:16px;color:#fff}
    </style><header><b>Загрузка следующей сторис</b><small>Реальный React-плеер · тестовые ролики</small></header>
    <div class="panes"><section><h2>До</h2><iframe id="before"></iframe><p id="before-note">Видео 2 ещё не запрошено</p></section>
    <section><h2>После</h2><iframe id="after"></iframe><p id="after-note">Видео 2 загружается в фоне</p></section></div>
    <footer><div id="phase">Смотрим первую сторис</div>Одинаковая задержка холодного ответа: 1,2 с. Кеш ответов имитируется.</footer>`);
  for (const before of [true, false]) {
    const id = before ? 'before' : 'after';
    const frame = page.frames().find(frame => frame !== page.mainFrame() && frame.name() === id);
    // iframe id is also the browsing context name in Chromium.
    const target = frame ?? await page.locator(`#${id}`).elementHandle().then(el => el.contentFrame());
    await target.setContent(`<style>
      *{box-sizing:border-box}body{margin:0;font-family:system-ui;--color-card-border:#323b4f;--color-card:#141821;--color-ink:#fff;--shadow-card:none}
      ${await styles(before)}
      #root{display:grid;place-items:start center;padding-top:10px}
      </style><div id="root"></div>`);
    await target.addScriptTag({ content: await bundle(before) });
  }
  const frames = page.frames().filter(frame => frame !== page.mainFrame());
  await Promise.all(frames.map(frame => frame.waitForFunction(() => document.querySelector('video')?.readyState >= 2, null, { timeout: 10000 })));
  await page.waitForFunction(() => typeof document.querySelector('#before').contentWindow.nextStory === 'function');
  assert(requests.some(url => url.endsWith('/after/2.mp4')), 'After must request story 2 in the background');
  assert(!requests.some(url => url.endsWith('/before/2.mp4')), 'Before must not prefetch video');
  while (!responses.has('https://story-demo.invalid/after/2.mp4')) await delay(50);
  await page.locator('#after-note').evaluate(el => { el.textContent = 'Видео 2 уже подгружено без воспроизведения'; });
  await page.mouse.move(0, 0);
  // Capture both panes in the same screenshot, with the same switch instant.
  const start = Date.now();
  for (let index = 0; index < 55; index += 1) {
    if (index === 12) {
      await page.evaluate(() => {
        document.querySelector('#phase').textContent = 'Переключаемся на вторую сторис';
        document.querySelector('#before-note').textContent = 'Запрос видео начинается при открытии';
        document.querySelector('#after-note').textContent = 'Подгруженный кадр появляется плавно';
        for (const iframe of document.querySelectorAll('iframe')) iframe.contentWindow.nextStory();
      });
    }
    await page.screenshot({ path: path.join(out, `frame-${String(index).padStart(3, '0')}.png`) });
    await delay(Math.max(0, start + (index + 1) * 100 - Date.now()));
  }
  for (const frame of frames) {
    assert.equal(await frame.evaluate(() => Boolean(window.mediaError)), false);
    assert.equal(await frame.locator('video').getAttribute('src'), `https://story-demo.invalid/${frame === frames[0] ? 'before' : 'after'}/2.mp4`);
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(out, 'requests.json'), JSON.stringify(requests, null, 2));
} finally {
  await browser.close();
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '10', '-i', path.join(out, 'frame-%03d.png'),
  '-filter_complex', '[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
  '-loop', '0', path.join(out, 'story-loading-before-after.gif')]);
console.log(path.join(out, 'story-loading-before-after.gif'));
