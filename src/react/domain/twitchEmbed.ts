type TwitchEmbedLocation = Pick<Location, 'hostname' | 'port' | 'protocol'>;

export function getTwitchEmbedUrl(
  channel: string,
  location: TwitchEmbedLocation = window.location,
): string | null {
  if (!canEmbedTwitch(location)) return null;

  const parameters = new URLSearchParams({
    channel,
    parent: location.hostname || 'localhost',
    autoplay: 'true',
  });

  return `https://player.twitch.tv/?${parameters}`;
}

export function getTwitchChannelUrl(channel: string): string {
  return `https://www.twitch.tv/${encodeURIComponent(channel)}`;
}

function canEmbedTwitch({ hostname, port, protocol }: TwitchEmbedLocation): boolean {
  if (hostname.toLowerCase() === 'localhost') {
    return protocol === 'http:' || protocol === 'https:';
  }

  return protocol === 'https:' && (port === '' || port === '443');
}
