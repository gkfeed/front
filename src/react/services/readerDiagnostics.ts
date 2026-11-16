const session = import.meta.env.DEV ? (Math.random().toString(36).slice(2, 14) || '0') : '';

/** Development-only timings; signed media URLs never leave the browser in diagnostics. */
export function readerDiagnostic(stage: string, itemId: string | number, detail?: string): void {
  if (!import.meta.env.DEV || !import.meta.hot) return;
  const id = String(itemId);
  const context = window.location.pathname.startsWith('/__verify/') || '__readerFixture' in window ? 'fixture' : 'app';
  import.meta.hot.send('reader:diagnostic', { stage, id, session, context, time: Date.now(), ...(detail ? { detail } : {}) });
}

export function tikTokDiagnostic(stage: string, postUrl: string, detail?: string): void {
  const id = postUrl.match(/\/(?:video|v)\/(\d+)/)?.[1] ?? 'unknown';
  readerDiagnostic(stage, id, detail);
}

/** Browser timing for the proxied media, without recording the media URL. */
export function tikTokMediaDiagnostic(stage: string, postUrl: string, media: HTMLMediaElement): void {
  if (!import.meta.env.DEV || !import.meta.hot) return;
  const entries = performance.getEntriesByName(media.currentSrc, 'resource') as PerformanceResourceTiming[];
  const last = entries.at(-1);
  const detail = last
    ? `requests=${entries.length} transfer=${last.transferSize} bytes=${last.encodedBodySize} ms=${Math.round(last.duration)}`
    : 'resource-timing-unavailable';
  tikTokDiagnostic(stage, postUrl, detail);
}
