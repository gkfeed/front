import type { OpenGraphProviderData } from './providerData.js';

export type {
  HltvCurrentMapPreview,
  HltvMapResultPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchSnapshot,
  HltvMatchStatus,
  HltvMatchTeamPreview,
  HltvMatchTeamSidesPreview,
  HltvPlayerStatsPreview,
  HltvProviderData,
  HltvRoundHalf,
  HltvRoundOutcome,
  HltvRoundPreview,
} from './providerData/hltv.js';
export type {
  OneFootballMatchSnapshot,
  OneFootballMatchTeamPreview,
  OneFootballProviderData,
} from './providerData/oneFootball.js';
export type { OpenGraphProviderData } from './providerData.js';

export interface OpenGraphMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  video: string | null;
  siteName: string | null;
  type: string | null;
}

export interface OpenGraphPreview extends OpenGraphMetadata {
  providerData: OpenGraphProviderData;
}

export type LiquipediaMatchResult = 'win' | 'loss' | 'default';

export interface LiquipediaMatchTeam {
  name: string;
  shortName: string;
  logo: string | null;
  results: LiquipediaMatchResult[];
}

export interface LiquipediaMatchPreview {
  date: string;
  status: string;
  score: [string, string];
  teams: [LiquipediaMatchTeam, LiquipediaMatchTeam];
  tournament: string;
}
