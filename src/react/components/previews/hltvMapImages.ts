const mapImages: Record<string, string> = {
  dust2: '/images/hltv/maps/dust2.webp',
  nuke: '/images/hltv/maps/nuke.webp',
  mirage: '/images/hltv/maps/mirage.webp',
  inferno: '/images/hltv/maps/inferno.webp',
  ancient: '/images/hltv/maps/ancient.webp',
  anubis: '/images/hltv/maps/anubis.webp',
  overpass: '/images/hltv/maps/overpass.webp',
  train: '/images/hltv/maps/train.webp',
  cache: '/images/hltv/maps/cache.webp',
};

export function getHltvMapImage(name: string): string | undefined {
  const key = name.toLowerCase().replace(/^de_/, '').replace(/[^a-z0-9]/g, '');
  return Object.hasOwn(mapImages, key) ? mapImages[key] : undefined;
}
