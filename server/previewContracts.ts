export interface HltvMatchTeamPreview {
  name: string;
  logo: string | null;
}

export interface HltvCurrentMapPreview {
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

export interface OpenGraphPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  video: string | null;
  siteName: string | null;
  type: string | null;
  matchStartsAt?: string | null;
  matchTeams?: [HltvMatchTeamPreview, HltvMatchTeamPreview] | null;
  matchStatus?: 'scheduled' | 'live' | 'over' | 'postponed' | 'deleted' | null;
  matchScore?: [string, string] | null;
  matchCurrentMap?: HltvCurrentMapPreview | null;
  matchPlayerStats?: HltvMatchPlayerStatsPreview | null;
  matchTeamSides?: HltvMatchTeamSidesPreview | null;
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
