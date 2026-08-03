export type MatreshkaTitleParts = {
  channel: string | null;
  title: string;
};

const MATRESHKA_TITLE_PATTERN = /^Видео\s+канала\s+(.+?)\s+[-–—]\s+(.+)$/iu;

export function parseMatreshkaTitle(sourceTitle: string, fallbackTitle = ''): MatreshkaTitleParts {
  const normalizedSourceTitle = sourceTitle.trim();
  const match = normalizedSourceTitle.match(MATRESHKA_TITLE_PATTERN);
  const channel = match?.[1]?.trim();
  const title = match?.[2]?.trim();

  if (channel && title) return { channel, title };

  return {
    channel: null,
    title: fallbackTitle.trim() || normalizedSourceTitle,
  };
}
