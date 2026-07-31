import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';

export function htmlResponse(
  body: string,
  url = new URL('https://example.com/'),
) {
  return {
    body: Readable.from([body]),
    headers: { 'content-type': 'text/html; charset=utf-8' },
    status: 200,
    url,
  };
}

export function gzipHtmlResponse(
  body: string,
  url: URL,
) {
  return {
    body: Readable.from([gzipSync(body)]),
    headers: {
      'content-encoding': 'gzip',
      'content-type': 'text/html; charset=utf-8',
    },
    status: 200,
    url,
  };
}

export function openGraphHtml(body: string): string {
  return `<html><head>${body}</head></html>`;
}

export function jsonLdScript(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}
