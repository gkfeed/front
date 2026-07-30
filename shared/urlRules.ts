export function isVkImageHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'vkuserphoto.ru'
    || normalized.endsWith('.vkuserphoto.ru')
    || normalized === 'userapi.com'
    || normalized.endsWith('.userapi.com');
}
