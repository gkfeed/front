import type { Agent as HttpsAgent } from 'node:https';
import * as socketIo from 'socket.io-client';

import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import {
  alignHltvRoundHistoryToScore,
} from './hltvHtmlParser.js';
import {
  parseHltvScorebotLog,
  parseHltvScorebotTeamIds,
  parseHltvScoreboardSnapshot,
  type HltvScorebotSnapshot,
  type HltvScorebotTeamIds,
} from './hltvScorebotParser.js';

const SCOREBOT_TIMEOUT_MS = 2_500;
const MAX_SCOREBOT_PAYLOAD_BYTES = 256_000;

export function requestHltvScorebotSnapshot({
  agent,
  context,
  headers,
  html,
  scorebotId,
  scorebotUrl,
  team1Id,
}: {
  agent: HttpsAgent;
  context?: RequestExecutionContext;
  headers: Record<string, string>;
  html: string;
  scorebotId: string;
  scorebotUrl: URL;
  team1Id: string;
}): Promise<HltvScorebotSnapshot | null> {
  return new Promise((resolve) => {
    const timeoutMs = context?.remainingMs(SCOREBOT_TIMEOUT_MS) ?? SCOREBOT_TIMEOUT_MS;
    const socket = socketIo.connect(scorebotUrl.href, {
      reconnection: false,
      timeout: timeoutMs,
      // HLTV's public Scorebot still speaks Socket.IO v2 / Engine.IO v3. It
      // starts with polling and may upgrade to a WebSocket, so both transports
      // must use the agent pinned after public-address validation.
      transports: ['polling', 'websocket'],
      transportOptions: {
        polling: { extraHeaders: headers, agent },
        websocket: {
          extraHeaders: headers,
          agent,
          maxPayload: MAX_SCOREBOT_PAYLOAD_BYTES,
        },
      },
    });
    let settled = false;
    let latestSnapshot: HltvScorebotSnapshot | null = null;
    let teamIds: HltvScorebotTeamIds | null = null;
    let roundHistory: HltvScorebotSnapshot['roundHistory'] = null;
    let pendingLogs: unknown[] = [];
    let finishTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (snapshot: HltvScorebotSnapshot | null) => {
      if (settled) return;
      settled = true;
      if (finishTimer) clearTimeout(finishTimer);
      clearTimeout(timeout);
      socket.close();
      context?.signal.removeEventListener('abort', abort);
      resolve(snapshot
        ? {
          ...snapshot,
          roundHistory: alignHltvRoundHistoryToScore(
            snapshot.roundHistory,
            snapshot.currentMap.score,
          ),
        }
        : null);
    };
    const scheduleFinish = () => {
      if (!latestSnapshot || !hasPlayerStats(latestSnapshot) || finishTimer) return;
      // A fullLog/log packet can immediately follow scoreboard. Let the event
      // loop deliver it before closing this short-lived connection.
      finishTimer = setTimeout(() => finish(latestSnapshot), 100);
    };
    const applyLog = (data: unknown) => {
      if (!teamIds) {
        pendingLogs.push(data);
        return;
      }
      if (latestSnapshot && isZeroMapScore(latestSnapshot.currentMap.score)) {
        roundHistory = [];
        latestSnapshot = { ...latestSnapshot, roundHistory };
        return;
      }
      roundHistory = parseHltvScorebotLog(
        data,
        teamIds.firstTeamId,
        teamIds.ctTeamId,
        teamIds.terroristTeamId,
        roundHistory ?? [],
      );
      if (latestSnapshot && roundHistory.length > 0) {
        latestSnapshot = { ...latestSnapshot, roundHistory };
      }
    };
    const flushPendingLogs = () => {
      const logs = pendingLogs;
      pendingLogs = [];
      logs.forEach(applyLog);
    };
    const timeout = setTimeout(() => finish(latestSnapshot), timeoutMs);
    const abort = () => finish(null);
    context?.signal.addEventListener('abort', abort, { once: true });

    socket.on('connect', () => {
      socket.emit('readyForMatch', JSON.stringify({ token: '', listId: scorebotId }));
    });
    socket.on('scoreboard', (data: unknown) => {
      const snapshot = parseHltvScoreboardSnapshot(data, html, team1Id);
      if (!snapshot) return;
      teamIds = parseHltvScorebotTeamIds(data, team1Id);
      if (isZeroMapScore(snapshot.currentMap.score)) {
        roundHistory = [];
        latestSnapshot = { ...snapshot, roundHistory };
      } else {
        if (!roundHistory && snapshot.roundHistory) roundHistory = snapshot.roundHistory;
        latestSnapshot = roundHistory?.length
          ? { ...snapshot, roundHistory }
          : snapshot;
      }
      flushPendingLogs();
      // Initial score/map updates can precede player rows. Keep listening so
      // an empty first update does not become the final snapshot.
      scheduleFinish();
    });
    socket.on('fullLog', applyLog);
    socket.on('fullLogUpdate', applyLog);
    socket.on('log', applyLog);
    socket.on('logUpdate', applyLog);
    socket.on('connect_error', () => finish(null));
  });
}

function hasPlayerStats(snapshot: HltvScorebotSnapshot): boolean {
  return snapshot.playerStats.some((team) => team.length > 0);
}

function isZeroMapScore(score: [string, string]): boolean {
  return score[0] === '0' && score[1] === '0';
}
