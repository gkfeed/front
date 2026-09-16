const SPOTIFY_ENTITY_ID = /^[A-Za-z0-9]{22}$/;

export type SpotifyEmbed = {
  url: string;
  height: 152 | 352;
  type: 'album' | 'playlist' | 'track';
};

export function getSpotifyEmbed(value: string): SpotifyEmbed | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'open.spotify.com') {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  const entityIndex = segments[0]?.startsWith('intl-') ? 1 : 0;
  const type = segments[entityIndex];
  if (!isSpotifyEmbedType(type) || segments.length !== entityIndex + 2) return null;

  const entityId = segments[entityIndex + 1];
  if (!entityId || !SPOTIFY_ENTITY_ID.test(entityId)) return null;

  return {
    url: `https://open.spotify.com/embed/${type}/${entityId}`,
    height: type === 'track' ? 152 : 352,
    type,
  };
}

export function getSpotifyDisplayTitle({
  url,
  fallbackTitle,
  previewTitle,
  previewDescription,
}: {
  url: string;
  fallbackTitle: string;
  previewTitle?: string | null;
  previewDescription?: string | null;
}): string {
  const embed = getSpotifyEmbed(url);
  if (embed?.type !== 'track' && embed?.type !== 'album') return fallbackTitle;

  const track = previewTitle
    ?.replace(/\s+-\s+(?:single|album|song)\s+by\s+.+?\s+\|\s+spotify$/i, '')
    .trim();
  const artists = previewDescription?.split('·', 1)[0]?.trim();
  return track && artists ? `${artists} - ${track}` : fallbackTitle;
}

export function getSpotifyReleaseDate({
  url,
  releaseDate,
}: {
  url: string;
  releaseDate?: string | null;
}): string | null {
  const embed = getSpotifyEmbed(url);
  if (!embed || embed.type === 'playlist' || !releaseDate) return null;
  return isReleaseDate(releaseDate) ? releaseDate : null;
}

function isReleaseDate(value: string): boolean {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2] ?? 1);
  const day = Number(match[3] ?? 1);
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

function isSpotifyEmbedType(value: string | undefined): value is SpotifyEmbed['type'] {
  return value === 'album' || value === 'playlist' || value === 'track';
}
