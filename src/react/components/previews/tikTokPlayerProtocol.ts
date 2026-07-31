export const TIKTOK_PLAYER_ORIGIN = 'https://www.tiktok.com';

export type TikTokPlayerReadyMessage = {
  type: 'onPlayerReady';
  'x-tiktok-player': true;
};

export type TikTokPlayerCommand = 'play' | 'unMute';
export type TikTokPlayerCommandMessage = {
  type: TikTokPlayerCommand;
  'x-tiktok-player': true;
};

export type TikTokPlayerAdapter = ReturnType<typeof createTikTokPlayerAdapter>;

export function createTikTokPlayerAdapter(
  getPlayerWindow: () => Window | null,
) {
  return {
    isReadyMessage(event: MessageEvent<unknown>): event is MessageEvent<TikTokPlayerReadyMessage> {
      const playerWindow = getPlayerWindow();
      return event.origin === TIKTOK_PLAYER_ORIGIN
        && playerWindow !== null
        && event.source === playerWindow
        && isTikTokPlayerReadyMessage(event.data);
    },

    play({ unmute = false }: { unmute?: boolean } = {}): void {
      const playerWindow = getPlayerWindow();
      if (unmute) sendCommand(playerWindow, 'unMute');
      sendCommand(playerWindow, 'play');
    },
  };
}

export function isTikTokPlayerReadyMessage(value: unknown): value is TikTokPlayerReadyMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message['x-tiktok-player'] === true && message.type === 'onPlayerReady';
}

function sendCommand(playerWindow: Window | null, type: TikTokPlayerCommand): void {
  if (!playerWindow) return;
  const message: TikTokPlayerCommandMessage = {
    type,
    'x-tiktok-player': true,
  };
  playerWindow.postMessage(message, TIKTOK_PLAYER_ORIGIN);
}
