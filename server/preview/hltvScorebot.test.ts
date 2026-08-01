import { beforeEach, describe, expect, it, vi } from 'vitest';

const socketConnect = vi.hoisted(() => vi.fn());
const resolvePublicAddress = vi.hoisted(() => vi.fn());
const createPinnedHttpsAgent = vi.hoisted(() => vi.fn());

vi.mock('socket.io-client', () => ({ connect: socketConnect }));
vi.mock('../publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../publicHttp.js')>(),
  createPinnedHttpsAgent,
  resolvePublicAddress,
}));

import { fetchHltvScorebotSnapshot } from './hltvScorebot.js';

beforeEach(() => {
  socketConnect.mockReset();
  resolvePublicAddress.mockReset();
  createPinnedHttpsAgent.mockReset();
});

describe('fetchHltvScorebotSnapshot', () => {
  it.each([
    'http://scorebot.hltv.org/socket.io',
    'https://hltv.org/socket.io',
    'https://hltv.org.evil.example/socket.io',
    'https://user:password@scorebot.hltv.org/socket.io',
  ])('does not connect to an invalid scorebot endpoint: %s', async (url) => {
    await expect(fetchHltvScorebotSnapshot(scorebotHtml(url), undefined, 'session=abc'))
      .resolves.toBeNull();
    expect(resolvePublicAddress).not.toHaveBeenCalled();
    expect(socketConnect).not.toHaveBeenCalled();
  });

  it('resolves and pins the validated endpoint before opening Scorebot', async () => {
    const agent = { destroy: vi.fn() };
    resolvePublicAddress.mockResolvedValue({ address: '203.0.113.10', family: 4 });
    createPinnedHttpsAgent.mockReturnValue(agent);
    socketConnect.mockImplementation(() => createSocket());

    const result = await fetchHltvScorebotSnapshot(
      scorebotHtml('https://scorebot.hltv.org/socket.io'),
      undefined,
      'session=abc',
    );

    expect(result).not.toBeNull();
    expect(resolvePublicAddress).toHaveBeenCalledWith(
      new URL('https://scorebot.hltv.org/socket.io'),
    );
    expect(createPinnedHttpsAgent).toHaveBeenCalledWith({
      address: '203.0.113.10',
      family: 4,
    });
    expect(socketConnect).toHaveBeenCalledWith(
      'https://scorebot.hltv.org/socket.io',
      expect.objectContaining({
        transports: ['polling', 'websocket'],
        transportOptions: expect.objectContaining({
          polling: expect.objectContaining({ agent }),
          websocket: expect.objectContaining({
            agent,
            maxPayload: 256_000,
          }),
        }),
      }),
    );
    expect(agent.destroy).toHaveBeenCalledOnce();
  });

  it('waits for player rows when the first scoreboard update is empty', async () => {
    const agent = { destroy: vi.fn() };
    resolvePublicAddress.mockResolvedValue({ address: '203.0.113.10', family: 4 });
    createPinnedHttpsAgent.mockReturnValue(agent);
    socketConnect.mockImplementation(() => createSocket([
      scoreboard({ CT: [], TERRORIST: [] }),
      scoreboard({
        CT: [{ nick: 'rain', score: 7, deaths: 3, assists: 2, damagePrRound: 91.26 }],
        TERRORIST: [{ nick: 'donk', score: 5, deaths: 4, assists: 1, damagePrRound: 84 }],
      }),
    ]));

    const result = await fetchHltvScorebotSnapshot(
      scorebotHtml('https://scorebot.hltv.org/socket.io'),
      undefined,
      'session=abc',
    );

    expect(result?.playerStats).toEqual([
      [{ nickname: 'rain', kills: 7, deaths: 3, assists: 2, adr: 91.3 }],
      [{ nickname: 'donk', kills: 5, deaths: 4, assists: 1, adr: 84 }],
    ]);
  });

  it('does not connect when the endpoint resolves to a private address', async () => {
    resolvePublicAddress.mockRejectedValue(new Error('private'));

    await expect(fetchHltvScorebotSnapshot(
      scorebotHtml('https://scorebot.hltv.org/socket.io'),
      undefined,
      'session=abc',
    )).resolves.toBeNull();

    expect(socketConnect).not.toHaveBeenCalled();
    expect(createPinnedHttpsAgent).not.toHaveBeenCalled();
  });
});

function scorebotHtml(url: string): string {
  return `<div id="scoreboardElement" data-scorebot-id="scorebot-test-${url}"
    data-team1-id="5973" data-scorebot-url="${url}"></div>
    <div class="mapholder"><div class="mapname">Dust2</div></div>`;
}

function createSocket(scoreboards = [scoreboard({
  CT: [{ nick: 'rain', score: 1, deaths: 0, assists: 0, damagePrRound: 100 }],
  TERRORIST: [],
})]) {
  const handlers = new Map<string, (data?: unknown) => void>();
  const socket = {
    on: vi.fn((event: string, handler: (data?: unknown) => void) => {
      handlers.set(event, handler);
      return socket;
    }),
    emit: vi.fn((event: string) => {
      if (event === 'readyForMatch') {
        scoreboards.forEach((update) => handlers.get('scoreboard')?.(update));
      }
    }),
    close: vi.fn(),
  };
  queueMicrotask(() => handlers.get('connect')?.());
  return socket;
}

function scoreboard(
  players: { CT: unknown[]; TERRORIST: unknown[] },
) {
  return {
    mapName: 'de_dust2',
    ctTeamId: 5973,
    tTeamId: 7020,
    ctTeamScore: 2,
    tTeamScore: 3,
    ...players,
  };
}
