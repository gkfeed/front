export type MatreshkaTitleParts = {
  channel: string | null;
  title: string;
};

const MATRESHKA_TITLE_PATTERNS = [
  /^Видео\s+канала\s+(.+?)\s+[-–—]\s+(.+)$/iu,
  /^(.+?)\s+-\s+(.+)$/u,
];
const MATRESHKA_CHANNEL_TAGLINE_PATTERN = /\s+[–—]\s+дом\s+для\s+видеоавторов\s+и\s+их\s+сообществ$/iu;

export function parseMatreshkaTitle(sourceTitle: string, fallbackTitle = ''): MatreshkaTitleParts {
  const normalizedSourceTitle = sourceTitle.trim();
  const match = MATRESHKA_TITLE_PATTERNS
    .map((pattern) => normalizedSourceTitle.match(pattern))
    .find((result) => result !== null);
  const channel = match?.[1]?.replace(MATRESHKA_CHANNEL_TAGLINE_PATTERN, '').trim();
  const title = match?.[2]?.trim();

  if (channel && title) return { channel, title };

  return {
    channel: null,
    title: fallbackTitle.trim() || normalizedSourceTitle,
  };
}
