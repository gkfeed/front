import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { extname, resolve } from 'node:path';

import { HttpRequestError } from './http/httpErrors.js';

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
  const safeFile = requestedFile.startsWith(`${resolvedRoot}/`)
    ? requestedFile
    : resolve(resolvedRoot, 'index.html');
  const file = await isFile(safeFile) ? safeFile : resolve(resolvedRoot, 'index.html');
  const fileStat = await stat(file);

  response.writeHead(200, {
    'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
    'content-length': fileStat.size,
    'content-type': contentType(file),
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
  });
  if (headOnly) response.end();
  else createReadStream(file).pipe(response);
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
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
