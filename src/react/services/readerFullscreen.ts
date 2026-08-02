export type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export const FALLBACK_FULLSCREEN_EVENT = 'readerfullscreenchange';

export function getFullscreenElement(): Element | null {
  const fullscreenDocument = document as FullscreenDocument;
  return document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

export function getMainElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('main');
}

export function setNativeFullscreenAttribute(main: HTMLElement | null, enabled: boolean): void {
  if (!main) return;
  if (enabled) main.dataset.readerFullscreen = 'true';
  else delete main.dataset.readerFullscreen;
}

export function setFallbackFullscreen(enabled: boolean): void {
  if (enabled) document.documentElement.dataset.readerFullscreen = 'true';
  else delete document.documentElement.dataset.readerFullscreen;
  document.dispatchEvent(new Event(FALLBACK_FULLSCREEN_EVENT));
}

export function rememberReviewActionsSize(main: HTMLElement): void {
  const actions = document.querySelector<HTMLElement>('.reader__actions:not([hidden])');
  if (!actions) return;

  const { height } = actions.getBoundingClientRect();
  if (height > 0) main.style.setProperty('--reader-actions-height', `${height}px`);
}

export function clearReviewActionsSize(main: HTMLElement | null): void {
  main?.style.removeProperty('--reader-actions-height');
}

export function isReaderFullscreen(): boolean {
  const main = getMainElement();
  return document.documentElement.dataset.readerFullscreen === 'true'
    || getFullscreenElement() === main;
}

export async function exitReaderFullscreen(): Promise<void> {
  const main = getMainElement();
  const fullscreenDocument = document as FullscreenDocument;
  const fullscreenElement = getFullscreenElement();

  if (document.documentElement.dataset.readerFullscreen === 'true') {
    setFallbackFullscreen(false);
  }
  setNativeFullscreenAttribute(main, false);
  clearReviewActionsSize(main);

  if (fullscreenElement !== main) return;
  if (document.exitFullscreen) await document.exitFullscreen();
  else if (fullscreenDocument.webkitExitFullscreen) await fullscreenDocument.webkitExitFullscreen();
}
