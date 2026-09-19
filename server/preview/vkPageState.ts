export function isVkMissingWallPage(html: string, url: URL): boolean {
  return /^\/wall-?\d+_\d+\/?$/i.test(url.pathname)
    && /data-testid=(?:"page_not_found_placeholder"|'page_not_found_placeholder')/i.test(html);
}
