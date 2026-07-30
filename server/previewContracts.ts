export interface OpenGraphPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  video: string | null;
  siteName: string | null;
  type: string | null;
  matchStartsAt?: string | null;
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
