import { normalizeExternalText } from '../../../shared/text';

export function getFeedItemDescription(content: string, title: string): string | null {
  if (!content || typeof DOMParser === 'undefined') return null;

  const document = new DOMParser().parseFromString(content, 'text/html');
  document.querySelectorAll('script, style, noscript').forEach((element) => element.remove());
  const description = normalizeExternalText(document.body.textContent ?? '');
  const normalizedTitle = normalizeExternalText(title).toLocaleLowerCase();
  return description && description.toLocaleLowerCase() !== normalizedTitle ? description : null;
}
