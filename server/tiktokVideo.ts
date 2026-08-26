import type { PreviewRedirect } from './application/previewContracts.js';
import {
  isRequestDeadlineExceeded,
  type RequestExecutionContext,
} from './application/requestExecutionContext.js';
import { requestPublicHttp, discardResponseBody } from './publicHttp.js';
import { parseTikTokVideoUrl } from './tiktokParser.js';
import { readLimitedJson } from './preview/bodyAdapters.js';
import { PreviewError } from './preview/errors.js';
import { parsePublicHttpUrl } from './preview/publicUrlPolicy.js';

const BROKER_RESPONSE_BYTES = 64_000;
const DEFAULT_BROKER_URL = 'http://ytdlp.gws.freemyip.com';
const POLL_INTERVAL_MS = 1_000;
const TIKTOK_FORMAT = 'b[vcodec^=h264][acodec!=none]/b[acodec!=none]/bv*+ba/b';

type BrokerTaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

export async function fetchTikTokVideo(
  input: string,
  context?: RequestExecutionContext,
): Promise<PreviewRedirect> {
  const videoUrl = parseTikTokVideoUrl(input);
  const brokerUrl = getBrokerUrl();
  const taskId = await enqueueDownload(brokerUrl, videoUrl.href, context);

  while (true) {
    const task = await getTaskResult(brokerUrl, taskId, context);
    if (task.status === 'completed') {
      const resultUrl = parseBrokerDownloadResult(task.result);
      if (!resultUrl) {
        throw new PreviewError('The TikTok broker returned an invalid download URL', 'invalid_tiktok_broker_response');
      }
      return { url: parsePublicHttpUrl(resultUrl).href };
    }
    if (task.status === 'failed') {
      throw new PreviewError('The TikTok broker could not download this video', 'tiktok_video_unavailable');
    }
    await waitForNextPoll(context);
  }
}

async function enqueueDownload(
  brokerUrl: URL,
  videoUrl: string,
  context?: RequestExecutionContext,
): Promise<string> {
  const payload = createBrokerDownloadPayload(videoUrl);
  const body = JSON.stringify(payload);
  const endpoint = new URL('/enqueue', brokerUrl);
  const response = await requestBroker(endpoint, context, {
    method: 'POST',
    body,
    headers: {
      'content-length': String(Buffer.byteLength(body)),
      'content-type': 'application/json',
    },
  });
  const value = await readBrokerJson(response, context);
  if (!isRecord(value) || typeof value.task_id !== 'string' || value.task_id.length === 0) {
    throw new PreviewError('The TikTok broker returned an invalid task', 'invalid_tiktok_broker_response');
  }
  return value.task_id;
}

async function getTaskResult(
  brokerUrl: URL,
  taskId: string,
  context?: RequestExecutionContext,
): Promise<{ status: BrokerTaskStatus; result: unknown }> {
  const endpoint = new URL(`/result/${encodeURIComponent(taskId)}`, brokerUrl);
  const response = await requestBroker(endpoint, context);
  const value = await readBrokerJson(response, context);
  if (!isRecord(value) || !isBrokerTaskStatus(value.status)) {
    throw new PreviewError('The TikTok broker returned an invalid status', 'invalid_tiktok_broker_response');
  }
  return { status: value.status, result: value.result };
}

async function requestBroker(
  endpoint: URL,
  context: RequestExecutionContext | undefined,
  options: {
    method?: 'GET' | 'POST';
    body?: string;
    headers?: Record<string, string>;
  } = {},
) {
  let response;
  try {
    response = await requestPublicHttp(endpoint, {
      accept: 'application/json',
      'user-agent': 'GKFeed/1.0',
      ...options.headers,
    }, context, { method: options.method, body: options.body });
  } catch {
    throw brokerUnavailable(context);
  }
  if (response.status < 200 || response.status >= 300) {
    discardResponseBody(response.body);
    throw new PreviewError(
      `The TikTok broker returned status ${response.status}`,
      'tiktok_broker_error',
    );
  }
  return response;
}

function readBrokerJson(
  response: Awaited<ReturnType<typeof requestPublicHttp>>,
  context?: RequestExecutionContext,
): Promise<unknown> {
  return readLimitedJson(response, {
    maximumBytes: BROKER_RESPONSE_BYTES,
    tooLarge: () => new PreviewError(
      'The TikTok broker response was too large',
      'tiktok_broker_response_too_large',
    ),
    invalidJson: () => new PreviewError(
      'The TikTok broker returned invalid data',
      'invalid_tiktok_broker_response',
    ),
    context,
  });
}

function getBrokerUrl(): URL {
  return parsePublicHttpUrl(
    process.env.TIKTOK_BROKER_URL?.trim()
    || process.env.BROKER_URL?.trim()
    || DEFAULT_BROKER_URL,
  );
}

export function createBrokerDownloadPayload(videoUrl: string) {
  return {
    function: 'ytdlp.download_video',
    data: [videoUrl, {
      format: TIKTOK_FORMAT,
      outtmpl: 'video.mp4',
    }],
  };
}

export function parseBrokerDownloadResult(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  return /^https?:\/\//i.test(candidate) ? candidate : null;
}

function waitForNextPoll(context?: RequestExecutionContext): Promise<void> {
  if (!context) return new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  if (context.signal.aborted || context.remainingMs() <= 0) return Promise.reject(brokerUnavailable(context));

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(done, Math.min(POLL_INTERVAL_MS, context.remainingMs()));
    const abort = () => {
      clearTimeout(timeout);
      context.signal.removeEventListener('abort', abort);
      reject(brokerUnavailable(context));
    };
    context.signal.addEventListener('abort', abort, { once: true });

    function done() {
      context?.signal.removeEventListener('abort', abort);
      resolve();
    }
  });
}

function brokerUnavailable(context?: RequestExecutionContext): PreviewError {
  return new PreviewError(
    context && isRequestDeadlineExceeded(context)
      ? 'The TikTok broker took too long to download the video'
      : 'The TikTok broker could not be reached',
    context && isRequestDeadlineExceeded(context)
      ? 'tiktok_broker_timeout'
      : 'tiktok_broker_failed',
  );
}

function isBrokerTaskStatus(value: unknown): value is BrokerTaskStatus {
  return value === 'pending' || value === 'processing' || value === 'completed' || value === 'failed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
