import { getObjectProperty } from '../unknownObject';
import type { OpenGraphPreview } from '../../../shared/previewContracts';

export type { OpenGraphPreview } from '../../../shared/previewContracts';

export async function getOpenGraphPreview(url: string, signal?: AbortSignal): Promise<OpenGraphPreview> {
  const response = await fetch(`/api/bff/open-graph?url=${encodeURIComponent(url)}`, { signal });
  if (!response.ok) throw new Error(`Preview request failed with ${response.status}`);

  const value: unknown = await response.json();
  if (!isOpenGraphPreview(value)) throw new Error('Invalid preview response');
  return {
    ...value,
    image: value.image ? getBrowserImageUrl(value.image) : null,
  };
}

function getBrowserImageUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);
    if (url.hostname.toLowerCase() === 'share.redd.it' && url.pathname.startsWith('/preview/post/')) {
      return `/api/bff/reddit-preview-image?url=${encodeURIComponent(url.href)}`;
    }
    if (url.protocol === 'http:' && url.hostname.toLowerCase() === 'api.url2png.com') {
      url.protocol = 'https:';
      return url.href;
    }
    if (url.protocol === 'http:' && isVkImageHost(url.hostname)) {
      url.protocol = 'https:';
      return url.href;
    }
  } catch {
    return imageUrl;
  }
  return imageUrl;
}

function isVkImageHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'vkuserphoto.ru'
    || normalized.endsWith('.vkuserphoto.ru')
    || normalized === 'userapi.com'
    || normalized.endsWith('.userapi.com');
}

function isOpenGraphPreview(value: unknown): value is OpenGraphPreview {
  const url = getObjectProperty(value, 'url');
  const title = getObjectProperty(value, 'title');
  const description = getObjectProperty(value, 'description');
  const image = getObjectProperty(value, 'image');
  const video = getObjectProperty(value, 'video');
  const siteName = getObjectProperty(value, 'siteName');
  const type = getObjectProperty(value, 'type');
  const matchStartsAt = getObjectProperty(value, 'matchStartsAt');
  const matchTeams = getObjectProperty(value, 'matchTeams');
  const matchStatus = getObjectProperty(value, 'matchStatus');
  const matchScore = getObjectProperty(value, 'matchScore');
  const matchCurrentMap = getObjectProperty(value, 'matchCurrentMap');
  const matchCompletedMaps = getObjectProperty(value, 'matchCompletedMaps');
  const matchPlayerStats = getObjectProperty(value, 'matchPlayerStats');
  const matchTeamSides = getObjectProperty(value, 'matchTeamSides');

  return typeof url === 'string'
    && [title, description, image, video, siteName, type].every(isNullableString)
    && (matchStartsAt === undefined || isNullableString(matchStartsAt))
    && (
      matchStatus === undefined
      || matchStatus === null
      || ['scheduled', 'live', 'over', 'postponed', 'deleted'].includes(String(matchStatus))
    )
    && (
      matchScore === undefined
      || matchScore === null
      || (
        Array.isArray(matchScore)
        && matchScore.length === 2
        && matchScore.every((part) => typeof part === 'string')
      )
    )
    && (
      matchCurrentMap === undefined
      || matchCurrentMap === null
      || isHltvCurrentMap(matchCurrentMap)
    )
    && (
      matchCompletedMaps === undefined
      || matchCompletedMaps === null
      || (
        Array.isArray(matchCompletedMaps)
        && matchCompletedMaps.every(isHltvCurrentMap)
      )
    )
    && (
      matchPlayerStats === undefined
      || matchPlayerStats === null
      || (
        Array.isArray(matchPlayerStats)
        && matchPlayerStats.length === 2
        && matchPlayerStats.every(
          (team) => Array.isArray(team) && team.every(isHltvPlayerStats),
        )
      )
    )
    && (
      matchTeamSides === undefined
      || matchTeamSides === null
      || (
        Array.isArray(matchTeamSides)
        && matchTeamSides.length === 2
        && (
          (matchTeamSides[0] === 'ct' && matchTeamSides[1] === 't')
          || (matchTeamSides[0] === 't' && matchTeamSides[1] === 'ct')
        )
      )
    )
    && (
      matchTeams === undefined
      || matchTeams === null
      || (
        Array.isArray(matchTeams)
        && matchTeams.length === 2
        && matchTeams.every(isHltvMatchTeam)
      )
    );
}

function isHltvPlayerStats(value: unknown): boolean {
  const nickname = getObjectProperty(value, 'nickname');
  const kills = getObjectProperty(value, 'kills');
  const deaths = getObjectProperty(value, 'deaths');
  const assists = getObjectProperty(value, 'assists');
  const adr = getObjectProperty(value, 'adr');
  return typeof nickname === 'string'
    && [kills, deaths, assists, adr].every(
      (number) => typeof number === 'number' && Number.isFinite(number),
    );
}

function isHltvCurrentMap(value: unknown): boolean {
  const name = getObjectProperty(value, 'name');
  const score = getObjectProperty(value, 'score');
  return typeof name === 'string'
    && Array.isArray(score)
    && score.length === 2
    && score.every((part) => typeof part === 'string');
}

function isHltvMatchTeam(value: unknown): boolean {
  const name = getObjectProperty(value, 'name');
  const logo = getObjectProperty(value, 'logo');
  return typeof name === 'string' && isNullableString(logo);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
