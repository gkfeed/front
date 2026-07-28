export type TikTokComment = {
  id: string;
  text: string;
  author: string;
  username: string;
  avatarUrl: string | null;
};

export async function fetchTikTokComments(url: string, signal: AbortSignal): Promise<TikTokComment[]> {
  const response = await fetch(`/api/bff/tiktok-comments?url=${encodeURIComponent(url)}`, { signal });
  if (!response.ok) throw new Error(`TikTok comments request failed with ${response.status}`);

  const value: unknown = await response.json();
  if (!isRecord(value) || !Array.isArray(value.comments) || !value.comments.every(isTikTokComment)) {
    throw new Error('Invalid TikTok comments response');
  }
  return value.comments;
}

function isTikTokComment(value: unknown): value is TikTokComment {
  return isRecord(value)
    && ['id', 'text', 'author', 'username'].every((key) => typeof value[key] === 'string')
    && (value.avatarUrl === null || typeof value.avatarUrl === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
