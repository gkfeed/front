export type ReaderMode = 'review' | 'scroll';

export function getReaderMode(search: string): ReaderMode {
  return new URLSearchParams(search).get('view') === 'scroll' ? 'scroll' : 'review';
}
