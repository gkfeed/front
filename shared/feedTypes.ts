export interface FeedTypeOption {
  value: string;
  label: string;
  display: 'icon' | 'initials';
  description: string;
}

export const FEED_TYPE_OPTIONS = [
  { value: 'web', label: 'Web', display: 'icon', description: 'A general website, RSS or Atom feed that does not match a more specific type.' },
  { value: 'tiktok', label: 'TikTok', display: 'icon', description: 'A TikTok creator or feed.' },
  { value: 'kinogo', label: 'Kinogo', display: 'initials', description: 'A Kinogo movie or TV source.' },
  { value: 'twitch', label: 'Twitch', display: 'initials', description: 'A Twitch channel.' },
  { value: 'yummyanime', label: 'YummyAnime', display: 'initials', description: 'A YummyAnime source.' },
  { value: 'shiki', label: 'Shiki', display: 'initials', description: 'A Shikimori anime or manga source.' },
  { value: 'reddit', label: 'Reddit', display: 'initials', description: 'A Reddit community or user feed.' },
  { value: 'vk', label: 'VK', display: 'initials', description: 'A VK community, profile or video source.' },
  { value: 'yt', label: 'YouTube', display: 'icon', description: 'A YouTube channel or creator feed.' },
  { value: 'ranobe.me', label: 'Ranobe.me', display: 'initials', description: 'A Ranobe.me light novel source.' },
  { value: 'author.today', label: 'Author.Today', display: 'initials', description: 'An Author.Today author or book source.' },
  { value: 'spoti', label: 'Spotify artist', display: 'initials', description: 'A Spotify artist feed.' },
  { value: 'rezka', label: 'Rezka', display: 'initials', description: 'A Rezka movie or TV source.' },
  { value: 'inst', label: 'Instagram', display: 'icon', description: 'An Instagram profile or posts feed.' },
  { value: 'stories', label: 'Instagram stories', display: 'icon', description: 'An Instagram stories feed.' },
  { value: 'insolarance', label: 'Insolarance', display: 'initials', description: 'An Insolarance source.' },
  { value: 'mangalib', label: 'MangaLib', display: 'initials', description: 'A MangaLib title or feed.' },
  { value: 'x', label: 'X', display: 'icon', description: 'An X or Twitter profile feed.' },
  { value: 'spoti:playlist', label: 'Spotify playlist', display: 'initials', description: 'A Spotify playlist.' },
  { value: 'onefootball', label: 'OneFootball', display: 'initials', description: 'A OneFootball team, competition or match source.' },
  { value: 'rtl', label: 'RTL', display: 'initials', description: 'An RTL source.' },
  { value: 'rezka:collection', label: 'Rezka collection', display: 'initials', description: 'A Rezka collection rather than one movie or TV title.' },
  { value: 'matreshka', label: 'Matreshka', display: 'initials', description: 'A Matreshka video source.' },
  { value: 'shiki:ongoing', label: 'Shiki ongoing', display: 'initials', description: 'A Shikimori ongoing releases feed.' },
  { value: 'anilibria', label: 'AniLibria', display: 'initials', description: 'An AniLibria anime source.' },
  { value: 'pornhub', label: 'PornHub', display: 'initials', description: 'A PornHub creator or video feed.' },
  { value: 'porno365', label: 'Porno365', display: 'initials', description: 'A Porno365 source.' },
  { value: 'hltv', label: 'HLTV', display: 'initials', description: 'An HLTV team, event, news or match source.' },
  { value: 'liquidpedia', label: 'Liquipedia', display: 'initials', description: 'A Liquipedia esports source.' },
  { value: 'sasflix', label: 'Sasflix', display: 'initials', description: 'A Sasflix movie or TV source.' },
] as const satisfies readonly FeedTypeOption[];

export type FeedType = (typeof FEED_TYPE_OPTIONS)[number]['value'];

const FEED_TYPES = new Set<string>(FEED_TYPE_OPTIONS.map(({ value }) => value));

export function isFeedType(value: unknown): value is FeedType {
  return typeof value === 'string' && FEED_TYPES.has(value);
}
