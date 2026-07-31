import { describe, expect, it, vi } from 'vitest';

import {
  createTikTokPlayerAdapter,
  TIKTOK_PLAYER_ORIGIN,
} from './tikTokPlayerProtocol';

describe('TikTok player protocol adapter', () => {
  it('accepts only a ready event from the configured player window and origin', () => {
    const playerWindow = { postMessage: vi.fn() } as unknown as Window;
    const otherWindow = {} as Window;
    const adapter = createTikTokPlayerAdapter(() => playerWindow);
    const data = { type: 'onPlayerReady', 'x-tiktok-player': true };

    expect(adapter.isReadyMessage({
      origin: TIKTOK_PLAYER_ORIGIN,
      source: playerWindow,
      data,
    } as MessageEvent)).toBe(true);
    expect(adapter.isReadyMessage({
      origin: 'https://evil.example',
      source: playerWindow,
      data,
    } as MessageEvent)).toBe(false);
    expect(adapter.isReadyMessage({
      origin: TIKTOK_PLAYER_ORIGIN,
      source: otherWindow,
      data,
    } as MessageEvent)).toBe(false);
    expect(adapter.isReadyMessage({
      origin: TIKTOK_PLAYER_ORIGIN,
      source: playerWindow,
      data: { type: 'play', 'x-tiktok-player': true },
    } as MessageEvent)).toBe(false);
  });

  it('sends typed commands to the configured player origin', () => {
    const postMessage = vi.fn();
    const playerWindow = { postMessage } as unknown as Window;
    const adapter = createTikTokPlayerAdapter(() => playerWindow);

    adapter.play({ unmute: true });

    expect(postMessage).toHaveBeenNthCalledWith(
      1,
      { type: 'unMute', 'x-tiktok-player': true },
      TIKTOK_PLAYER_ORIGIN,
    );
    expect(postMessage).toHaveBeenNthCalledWith(
      2,
      { type: 'play', 'x-tiktok-player': true },
      TIKTOK_PLAYER_ORIGIN,
    );
  });
});
