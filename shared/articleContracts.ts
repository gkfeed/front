export type ArticleBlock =
  | { type: 'paragraph' | 'quote'; text: string }
  | { type: 'heading'; text: string; level: number }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'image'; src: string; alt: string };

export interface ArticlePreview {
  url: string;
  title: string;
  byline: string | null;
  excerpt: string | null;
  blocks: ArticleBlock[];
}

export function isArticlePreview(value: unknown): value is ArticlePreview {
  if (!isRecord(value)
    || typeof value.url !== 'string'
    || typeof value.title !== 'string'
    || !isNullableString(value.byline)
    || !isNullableString(value.excerpt)
    || !Array.isArray(value.blocks)
    || value.blocks.length === 0) return false;

  return value.blocks.every(isArticleBlock);
}

function isArticleBlock(value: unknown): value is ArticleBlock {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  if (value.type === 'paragraph' || value.type === 'quote') return typeof value.text === 'string';
  if (value.type === 'heading') {
    return typeof value.text === 'string'
      && typeof value.level === 'number'
      && value.level >= 1
      && value.level <= 6;
  }
  if (value.type === 'list') {
    return typeof value.ordered === 'boolean'
      && Array.isArray(value.items)
      && value.items.every((item) => typeof item === 'string');
  }
  return value.type === 'image'
    && typeof value.src === 'string'
    && typeof value.alt === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
