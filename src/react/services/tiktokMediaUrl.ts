export function tikTokMediaProxy(url: string): string {
  return `/bff/tiktok-media?url=${encodeURIComponent(url)}`;
}
