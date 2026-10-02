import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { extname, resolve, sep } from 'node:path';

import { HttpRequestError } from './httpErrors.js';

const staticRoot = resolve(process.cwd(), 'dist');

export async function serveFrontend(
  pathname: string,
  headOnly: boolean,
  response: ServerResponse,
  root = staticRoot,
): Promise<void> {
  const resolvedRoot = resolve(root);
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new HttpRequestError('Invalid path', 'invalid_path', 400);
  }

  const requestedFile = resolve(resolvedRoot, `.${decodedPath}`);
  const rootPath = await realpath(resolvedRoot);
  const candidate = requestedFile.startsWith(`${resolvedRoot}${sep}`)
    ? await resolveExistingFile(requestedFile)
    : undefined;
  if (candidate && !candidate.startsWith(`${rootPath}${sep}`)) {
    throw new HttpRequestError('File not found', 'not_found', 404);
  }
  if (!candidate && (decodedPath === '/assets' || decodedPath.startsWith('/assets/') || extname(decodedPath))) {
    throw new HttpRequestError('File not found', 'not_found', 404);
  }
  const file = candidate ?? resolve(rootPath, 'index.html');
  const fileStat = await stat(file);

  response.writeHead(200, {
    'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'content-length': fileStat.size,
    'content-type': contentType(file),
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
  });
  if (headOnly) {
    response.end();
    return;
  }

  await pipeline(createReadStream(file), response);
}

async function resolveExistingFile(path: string): Promise<string | undefined> {
  try {
    const file = await realpath(path);
    return (await stat(file)).isFile() ? file : undefined;
  } catch {
    return undefined;
  }
}

function contentType(file: string): string {
  return ({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
  } as Record<string, string>)[extname(file)] ?? 'application/octet-stream';
}
