export type YoutubePlayerCommand = 'playVideo' | 'pauseVideo' | 'setPlaybackRate' | 'seekTo';

export function sendPlaybackRate(
  iframe: HTMLIFrameElement | null,
  playbackRate: number,
): void {
  sendPlayerCommand(iframe, 'setPlaybackRate', [playbackRate]);
}

export function sendPlayerCommand(
  iframe: HTMLIFrameElement | null,
  func: YoutubePlayerCommand,
  args: unknown[] = [],
): void {
  iframe?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
}
