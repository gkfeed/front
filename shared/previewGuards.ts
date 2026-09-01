import type { OpenGraphPreview } from './previewContracts.js';
import { isOpenGraphProviderData } from './providerData.js';
import { isRecord } from './valueGuards.js';

export { isHltvProviderData } from './providerData/hltv.js';
export { isOneFootballProviderData } from './providerData/oneFootball.js';

export function isOpenGraphPreview(value: unknown): value is OpenGraphPreview {
  if (!isRecord(value)) return false;
  const object = value;

  return typeof object.url === 'string'
    && [object.title, object.description, object.image, object.video, object.siteName, object.type]
      .every(isNullableString)
    && isOpenGraphProviderData(object.providerData);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
