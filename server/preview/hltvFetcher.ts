import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PreviewError } from './errors.js';
import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
} from '../../shared/previewContracts.js';
import { responseTooLarge } from './bodyReaders.js';
import { parseHltvMatchStatus } from './hltvParser.js';
import { fetchHltvScorebotSnapshot } from './hltvScorebot.js';

const MAX_HLTV_RESPONSE_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 8_000;
const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';
const execFileAsync = promisify(execFile);

export interface HltvPage {
  html: string;
  url: URL;
  currentMap: HltvCurrentMapPreview | null;
  playerStats: HltvMatchPlayerStatsPreview | null;
  teamSides: HltvMatchTeamSidesPreview | null;
}

export async function fetchHltvHtml(url: URL): Promise<HltvPage> {
  const directory = await mkdtemp(join(tmpdir(), 'gkfeed-hltv-'));
  const output = join(directory, 'response');
  const cookies = join(directory, 'cookies.txt');
  try {
    await execFileAsync('aria2c', [
      '--quiet=true',
      '--allow-overwrite=true',
      '--auto-file-renaming=false',
      '--max-tries=1',
      '--connect-timeout=8',
      '--timeout=8',
      '--save-cookies',
      cookies,
      '--header',
      `User-Agent: ${TWITTERBOT_USER_AGENT}`,
      '--dir',
      directory,
      '--out',
      'response',
      url.href,
    ], { timeout: REQUEST_TIMEOUT_MS });

    const body = await readFile(output);
    if (body.byteLength > MAX_HLTV_RESPONSE_BYTES) throw responseTooLarge();
    const html = body.toString('utf8');
    const scorebot = parseHltvMatchStatus(html) === 'live'
      ? await fetchHltvScorebotSnapshot(html, cookies)
      : null;
    return {
      html,
      url,
      currentMap: scorebot?.currentMap ?? null,
      playerStats: scorebot?.playerStats ?? null,
      teamSides: scorebot?.teamSides ?? null,
    };
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('The HLTV page could not be fetched', 502, 'fetch_failed');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
