export interface FeedTypeOption {
  value: string;
  label: string;
  display: 'icon' | 'initials';
}

export const FEED_TYPE_OPTIONS = [
  { value: 'web', label: 'Web', display: 'icon' },
  { value: 'tiktok', label: 'TikTok', display: 'icon' },
  { value: 'kinogo', label: 'Kinogo', display: 'initials' },
  { value: 'twitch', label: 'Twitch', display: 'initials' },
  { value: 'yummyanime', label: 'YummyAnime', display: 'initials' },
  { value: 'shiki', label: 'Shiki', display: 'initials' },
  { value: 'reddit', label: 'Reddit', display: 'initials' },
  { value: 'vk', label: 'VK', display: 'initials' },
  { value: 'yt', label: 'YouTube', display: 'icon' },
  { value: 'ranobe.me', label: 'Ranobe.me', display: 'initials' },
  { value: 'spoti', label: 'Spotify artist', display: 'initials' },
  { value: 'rezka', label: 'Rezka', display: 'initials' },
  { value: 'inst', label: 'Instagram', display: 'icon' },
  { value: 'stories', label: 'Instagram stories', display: 'icon' },
  { value: 'insolarance', label: 'Insolarance', display: 'initials' },
  { value: 'mangalib', label: 'MangaLib', display: 'initials' },
  { value: 'x', label: 'X', display: 'icon' },
  { value: 'spoti:playlist', label: 'Spotify playlist', display: 'initials' },
  { value: 'onefootball', label: 'OneFootball', display: 'initials' },
  { value: 'rtl', label: 'RTL', display: 'initials' },
  { value: 'rezka:collection', label: 'Rezka collection', display: 'initials' },
  { value: 'matreshka', label: 'Matreshka', display: 'initials' },
  { value: 'shiki:ongoing', label: 'Shiki ongoing', display: 'initials' },
  { value: 'anilibria', label: 'AniLibria', display: 'initials' },
  { value: 'pornhub', label: 'PornHub', display: 'initials' },
  { value: 'porno365', label: 'Porno365', display: 'initials' },
  { value: 'hltv', label: 'HLTV', display: 'initials' },
  { value: 'liquidpedia', label: 'Liquipedia', display: 'initials' },
  { value: 'sasflix', label: 'Sasflix', display: 'initials' },
] as const satisfies readonly FeedTypeOption[];
