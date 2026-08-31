const DEFAULT_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'iframe',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'video',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type FocusNavigationEvent = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>;

export function trapFocus(
  event: FocusNavigationEvent,
  container: HTMLElement | null,
  {
    fallback = container,
    visibleOnly = false,
  }: {
    fallback?: HTMLElement | null;
    visibleOnly?: boolean;
  } = {},
): void {
  if (event.key !== 'Tab') return;

  const focusable = getFocusableElements(container, visibleOnly);
  if (focusable.length === 0) {
    if (!fallback) return;
    event.preventDefault();
    fallback.focus();
    return;
  }

  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  } else if (!container?.contains(document.activeElement)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

function getFocusableElements(container: HTMLElement | null, visibleOnly: boolean): HTMLElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>(DEFAULT_FOCUSABLE_SELECTOR)]
    .filter((element) => element.tabIndex >= 0)
    .filter((element) => !visibleOnly || element.offsetParent !== null);
}
