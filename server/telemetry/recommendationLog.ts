import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { classifyRecommendationEvent, CLASSIFICATION_VERSION } from '../../shared/recommendationScoring.js';
import { isRecommendationEvent, pickRecommendationEvent } from '../../shared/recommendationEvents.js';
import { HttpRequestError } from '../http/httpErrors.js';
import { sendJson } from '../http/httpResponse.js';

const MAX_BODY_BYTES = 1024 * 1024;
let pendingWrite: Promise<void> = Promise.resolve();

export async function recordRecommendationEvents(
  request: IncomingMessage,
  response: ServerResponse,
  logPath = process.env.RECOMMENDATION_LOG_PATH ?? resolve('data/recommendation-events.jsonl'),
): Promise<void> {
  if (request.method !== 'POST') throw new HttpRequestError('Method not allowed', 'method_not_allowed', 405);
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new HttpRequestError('Expected application/json', 'invalid_content_type', 415);
  }
  // Browsers must submit from this origin; no CORS or public read endpoint is exposed.
  if (request.headers.origin) {
    let originHost: string | undefined;
    try { originHost = new URL(request.headers.origin).host; } catch { /* Invalid origin. */ }
    if (originHost !== request.headers.host) {
      throw new HttpRequestError('Origin not allowed', 'invalid_origin', 403);
    }
  }
  if (Number(request.headers['content-length']) > MAX_BODY_BYTES) {
    request.resume();
    throw new HttpRequestError('Batch too large', 'body_too_large', 413);
  }
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) {
      request.resume();
      throw new HttpRequestError('Batch too large', 'body_too_large', 413);
    }
    chunks.push(bytes);
  }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpRequestError('Invalid JSON', 'invalid_json', 400); }
  const events = (body as { events?: unknown } | null)?.events;
  if (!Array.isArray(events) || events.length < 1 || events.length > 20 || !events.every(isRecommendationEvent)) {
    throw new HttpRequestError('Invalid event batch', 'invalid_events', 400);
  }
  const receivedAt = new Date().toISOString();
  const lines = events.map((event) => JSON.stringify({ ...pickRecommendationEvent(event), category: classifyRecommendationEvent(event), classificationVersion: CLASSIFICATION_VERSION, receivedAt })).join('\n') + '\n';
  const write = pendingWrite.catch(() => {}).then(async () => {
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, lines, { mode: 0o600 });
  });
  pendingWrite = write;
  await write;
  sendJson(response, 200, { accepted: events.length });
}
