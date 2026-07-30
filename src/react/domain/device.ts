export function isAppleMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iP(?:hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
