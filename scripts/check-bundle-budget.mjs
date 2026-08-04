import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const assetsDirectory = join(process.cwd(), 'dist', 'assets');
const assets = readdirSync(assetsDirectory);
const entryJavaScript = assets.find((asset) => /^index-[^/]+\.js$/.test(asset));
const entryCss = assets.find((asset) => /^index-[^/]+\.css$/.test(asset));

if (!entryJavaScript || !entryCss) {
  throw new Error('Could not identify the Vite entry assets for the bundle budget');
}

const budgets = [
  { asset: entryJavaScript, maximumBytes: 350_000 },
  { asset: entryCss, maximumBytes: 40_000 },
];

for (const { asset, maximumBytes } of budgets) {
  const size = statSync(join(assetsDirectory, asset)).size;
  if (size > maximumBytes) {
    throw new Error(`${asset} is ${size} bytes, above the ${maximumBytes}-byte budget`);
  }
  console.log(`bundle budget: ${asset} ${size}/${maximumBytes} bytes`);
}
