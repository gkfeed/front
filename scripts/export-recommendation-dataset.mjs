import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

import { isRecommendationEvent } from '../shared/recommendationEvents.ts';
import { classifyRecommendationItems, scoreRecommendationFeeds } from '../shared/recommendationScoring.ts';

const args = process.argv.slice(2);
const input = args.find((arg) => arg !== '--feed-scores')
  ?? process.env.RECOMMENDATION_LOG_PATH ?? 'data/recommendation-events.jsonl';
const decisions = [];
let malformed = 0;
for await (const line of createInterface({ input: createReadStream(input), crlfDelay: Infinity })) {
  if (!line.trim()) continue;
  try {
    const event = JSON.parse(line);
    if (!isRecommendationEvent(event)) { malformed++; continue; }
    decisions.push(event);
  } catch { malformed++; }
}
const rows = args.includes('--feed-scores')
  ? scoreRecommendationFeeds(decisions)
  : classifyRecommendationItems(decisions);
for (const row of rows) process.stdout.write(JSON.stringify(row) + '\n');
if (malformed) process.stderr.write(`Skipped ${malformed} malformed lines.\n`);
