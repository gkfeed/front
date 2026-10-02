import { FEED_TYPE_OPTIONS, isFeedType } from '../shared/feedTypes.js';
import type { FeedTypeSuggestion } from '../shared/feedTypeSuggestion.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { HttpRequestError } from './http/httpErrors.js';

const OPENROUTER_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
const JEV_MODEL = 'typesafe/jev-1.13';
const REQUEST_TIMEOUT_MS = 5_000;

type JevChoiceAnswer = {
  type: 'choice';
  choice: string;
  confidence: number;
};

export async function suggestFeedType(
  input: { url: string; title?: string },
  context: RequestExecutionContext,
  apiKey = process.env.OPENROUTER_API_KEY?.trim(),
  fetchImplementation: typeof fetch = fetch,
): Promise<FeedTypeSuggestion> {
  if (!apiKey) {
    throw new HttpRequestError(
      'Feed type detection is not configured',
      'feed_type_detection_unavailable',
      503,
    );
  }

  const timeoutMs = context.remainingMs(REQUEST_TIMEOUT_MS);
  if (timeoutMs <= 0) throw new Error('Feed type detection timed out');
  const signal = AbortSignal.any([context.signal, AbortSignal.timeout(timeoutMs)]);
  const response = await fetchImplementation(OPENROUTER_DECISIONS_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'x-openrouter-title': 'GKFEED',
    },
    body: JSON.stringify({
      model: JEV_MODEL,
      state: {
        url: input.url,
        ...(input.title?.trim() ? { user_supplied_title: input.title.trim() } : {}),
      },
      questions: {
        feed_type: {
          type: 'choice',
          instructions: 'Which GKFEED source type best matches this URL and optional title? Choose web when no specialized source clearly matches.',
          criteria: Object.fromEntries(FEED_TYPE_OPTIONS.map(({ value, description }) => [
            value,
            description,
          ])),
        },
      },
    }),
    signal,
  });

  if (!response.ok) throw new Error(`OpenRouter Decisions returned HTTP ${response.status}`);
  const body: unknown = await response.json();
  const answer = parseChoiceAnswer(body);
  if (!answer || !isFeedType(answer.choice)) {
    throw new Error('OpenRouter Decisions returned an invalid feed type');
  }
  return { type: answer.choice, confidence: answer.confidence };
}

function parseChoiceAnswer(value: unknown): JevChoiceAnswer | null {
  if (!value || typeof value !== 'object') return null;
  const answers = (value as Record<string, unknown>).answers;
  if (!answers || typeof answers !== 'object') return null;
  const answer = (answers as Record<string, unknown>).feed_type;
  if (!answer || typeof answer !== 'object') return null;
  const candidate = answer as Record<string, unknown>;
  return candidate.type === 'choice'
    && typeof candidate.choice === 'string'
    && typeof candidate.confidence === 'number'
    && candidate.confidence >= 0
    && candidate.confidence <= 1
    ? candidate as JevChoiceAnswer
    : null;
}
