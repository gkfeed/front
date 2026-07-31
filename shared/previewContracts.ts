export interface HltvMatchTeamPreview {
  name: string;
  logo: string | null;
}

export interface HltvCurrentMapPreview {
  name: string;
  score: [string, string];
}

export interface HltvMapResultPreview {
  name: string;
  score: [string, string];
}

export interface HltvPlayerStatsPreview {
  nickname: string;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
}

export type HltvMatchPlayerStatsPreview = [
  HltvPlayerStatsPreview[],
  HltvPlayerStatsPreview[],
];

export type HltvMatchTeamSidesPreview = ['ct', 't'] | ['t', 'ct'];

export type HltvMatchStatus = 'scheduled' | 'live' | 'over' | 'postponed' | 'deleted';

export interface OpenGraphMetadata {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  video: string | null;
  siteName: string | null;
  type: string | null;
}

export interface HltvMatchSnapshot {
  startsAt: string | null;
  teams: [HltvMatchTeamPreview, HltvMatchTeamPreview] | null;
  status: HltvMatchStatus | null;
  score: [string, string] | null;
  currentMap: HltvCurrentMapPreview | null;
  completedMaps: HltvMapResultPreview[] | null;
  playerStats: HltvMatchPlayerStatsPreview | null;
  teamSides: HltvMatchTeamSidesPreview | null;
}

export interface HltvProviderData {
  provider: 'hltv';
  snapshot: HltvMatchSnapshot;
}

export type OpenGraphProviderData = HltvProviderData | null;

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
