const NON_RENDERING_REPLACEMENT_CHARACTERS = /[\uFFFC\uFFFD]/gu;

/**
 * Normalizes text received from external providers before it is displayed.
 *
 * U+FFFD is inserted when a byte sequence cannot be decoded as Unicode and
 * U+FFFC is the object-replacement marker. Neither character is the original
 * content, so keeping it in a feed item only renders a misleading tofu box.
 */
export function normalizeExternalText(value: string): string {
  return value
    .normalize('NFC')
    .replace(NON_RENDERING_REPLACEMENT_CHARACTERS, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
