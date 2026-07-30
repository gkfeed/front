const NSFW_HOST_LABELS = new Set(['porno365', 'pornhub']);

export function isNsfwLink(link: string): boolean {
  try {
    const hostnameLabels = new URL(link).hostname.toLowerCase().split('.');
    return hostnameLabels.some((label) => NSFW_HOST_LABELS.has(label));
  } catch {
    return false;
  }
}
