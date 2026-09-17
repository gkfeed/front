import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import AdmZip from 'adm-zip';

const ARIA2_VERSION = '1.37.0';
const ARIA2_ARCHIVE = `aria2-${ARIA2_VERSION}-win-64bit-build1.zip`;
const ARIA2_SHA256 = '67d015301eef0b612191212d564c5bb0a14b5b9c4796b76454276a4d28d9b288';
const ARIA2_URL = `https://github.com/aria2/aria2/releases/download/release-${ARIA2_VERSION}/${ARIA2_ARCHIVE}`;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(repositoryRoot, 'build', 'vendor', 'aria2');
const temporaryRoot = join(repositoryRoot, 'build', '.aria2-download');
const archivePath = join(temporaryRoot, ARIA2_ARCHIVE);
const extractedRoot = join(temporaryRoot, `aria2-${ARIA2_VERSION}-win-64bit-build1`);

await rm(temporaryRoot, { recursive: true, force: true });
await mkdir(temporaryRoot, { recursive: true });

try {
  const response = await fetch(ARIA2_URL);
  if (!response.ok) throw new Error(`aria2 download failed with HTTP ${response.status}`);
  await writeFile(archivePath, new Uint8Array(await response.arrayBuffer()));

  const digest = createHash('sha256').update(await readFile(archivePath)).digest('hex');
  if (digest !== ARIA2_SHA256) {
    throw new Error(`aria2 checksum mismatch: expected ${ARIA2_SHA256}, received ${digest}`);
  }

  new AdmZip(archivePath).extractAllTo(temporaryRoot, true);
  await rm(destination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
  await rename(extractedRoot, destination);
  console.log(`Prepared ${basename(destination)} ${ARIA2_VERSION} for Windows x64`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
