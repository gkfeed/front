import type { HltvProviderData } from '../../shared/previewContracts.js';
import {
  parseHltvCompletedMaps,
  parseHltvCurrentMap,
  parseHltvMatchScore,
  parseHltvMatchStartsAt,
  parseHltvMatchStatus,
  parseHltvMatchTeams,
  parseHltvMatchTournament,
  parseHltvPlayerStats,
  parseHltvRoundHistory,
} from './hltvHtmlParser.js';

export function parseHltvProviderData(html: string, pageUrl: URL): HltvProviderData {
  const status = parseHltvMatchStatus(html);
  return {
    provider: 'hltv',
    snapshot: {
      startsAt: parseHltvMatchStartsAt(html),
      tournament: parseHltvMatchTournament(html),
      teams: parseHltvMatchTeams(html, pageUrl),
      status,
      score: status === 'live' || status === 'over' ? parseHltvMatchScore(html) : null,
      currentMap: status === 'live' ? parseHltvCurrentMap(html) : null,
      completedMaps: parseHltvCompletedMaps(html),
      roundHistory: parseHltvRoundHistory(html),
      playerStats: status === 'over' ? parseHltvPlayerStats(html) : null,
      teamSides: null,
    },
  };
}
