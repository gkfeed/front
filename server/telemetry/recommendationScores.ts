import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import type { ServerResponse } from 'node:http';

import { isRecommendationEvent, type RecommendationEvent } from '../../shared/recommendationEvents.js';
import { CLASSIFICATION_VERSION, VIEWED_THRESHOLD_MS, scoreRecommendationFeeds } from '../../shared/recommendationScoring.js';
import { HttpRequestError } from '../http/httpErrors.js';
import { sendJson } from '../http/httpResponse.js';

export async function sendRecommendationFeedScores(url: URL, response: ServerResponse): Promise<void> {
  const subjectId = url.searchParams.get('subjectId');
  if (!subjectId || subjectId.length > 100) {
    throw new HttpRequestError('subjectId is required', 'invalid_subject', 400);
  }
  const events: RecommendationEvent[] = [];
  const input = createReadStream(process.env.RECOMMENDATION_LOG_PATH ?? resolve('data/recommendation-events.jsonl'));
  try {
    for await (const line of createInterface({ input, crlfDelay: Infinity })) {
      let value: unknown;
      try { value = JSON.parse(line); } catch { continue; }
      if (isRecommendationEvent(value) && value.subjectId === subjectId) events.push(value);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  } finally { input.destroy(); }
  response.setHeader('Cache-Control', 'no-store');
  sendJson(response, 200, {
    classificationVersion: CLASSIFICATION_VERSION,
    viewedThresholdMs: VIEWED_THRESHOLD_MS,
    feeds: scoreRecommendationFeeds(events),
  });
}
