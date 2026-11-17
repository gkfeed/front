import type { TikTokPlaybackPreview } from '../shared/tiktokContracts.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { PreviewError } from './preview/errors.js';
import { fetchTikTokDirectPlayback } from './tiktokDirectPlayback.js';
import { parseTikTokVideoUrl } from './tiktokUrlParser.js';

export async function fetchTikTokPlayback(
  input: string,
  context?: RequestExecutionContext,
): Promise<TikTokPlaybackPreview> {
  const post = parseTikTokVideoUrl(input);
  try {
    const direct = await fetchDirectPlaybackWithRecovery(post, context);
    if (direct) return direct;
  } catch (error) {
    if (error instanceof PreviewError && error.kind === 'tiktok_post_unavailable') throw error;
    if (context?.signal.aborted) throw new PreviewError('TikTok playback request aborted', 'tiktok_upstream_unavailable');
  }
  throw new PreviewError('TikTok did not provide playable media', 'tiktok_upstream_unavailable');
}

// Recover transient TikTok page/probe failures using at most two direct attempts.
// Keep recovery inside the shared BFF load so prefetch and visible consumers
// still share one operation rather than racing duplicate browser requests.
const DIRECT_RECOVERY_DELAY_MS = 750;

function fetchDirectPlaybackWithRecovery(
  post: URL,
  context?: RequestExecutionContext,
): Promise<TikTokPlaybackPreview | null> {
  const controller = new AbortController();
  const localContext: RequestExecutionContext = {
    signal: controller.signal,
    deadline: context?.deadline ?? Infinity,
    remainingMs: (maximum = Infinity) => context?.remainingMs(maximum) ?? maximum,
  };
  return new Promise((resolve, reject) => {
    let started = 0;
    let failed = 0;
    let settled = false;
    const finish = (value: TikTokPlaybackPreview | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context?.signal.removeEventListener('abort', onAbort);
      controller.abort();
      if (error) reject(error);
      else resolve(value);
    };
    const onAbort = () => finish(null, new PreviewError('TikTok playback request aborted', 'tiktok_upstream_unavailable'));
    const unsuccessful = () => {
      if (settled) return;
      failed += 1;
      if (started === 1) {
        clearTimeout(timer);
        attempt();
      }
      if (failed === 2) finish(null);
    };
    const attempt = () => {
      if (settled || started === 2) return;
      started += 1;
      void fetchTikTokDirectPlayback(post, localContext).then((value) => {
        if (value) finish(value);
        else unsuccessful();
      }, (error: unknown) => {
        if (error instanceof PreviewError && error.kind === 'tiktok_post_unavailable') finish(null, error);
        else unsuccessful();
      });
    };
    const timer = setTimeout(attempt, DIRECT_RECOVERY_DELAY_MS);
    context?.signal.addEventListener('abort', onAbort, { once: true });
    if (context?.signal.aborted) { onAbort(); return; }
    attempt();
  });
}
