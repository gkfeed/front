import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';

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
  const requestedRelativePath = relative(resolvedRoot, requestedFile);
  const safeFile = !isAbsolute(requestedRelativePath)
    && requestedRelativePath !== '..'
    && !requestedRelativePath.startsWith(`..${sep}`)
    ? requestedFile
    : resolve(resolvedRoot, 'index.html');
  const file = await isFile(safeFile) ? safeFile : resolve(resolvedRoot, 'index.html');
  const fileStat = await stat(file);
  const relativeFile = relative(resolvedRoot, file);
  const isAsset = relativeFile === 'assets' || relativeFile.startsWith(`assets${sep}`);

  response.writeHead(200, {
    'cache-control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
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
