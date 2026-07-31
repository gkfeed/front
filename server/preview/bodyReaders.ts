export {
  MAX_IMAGE_RESPONSE_BYTES,
  MAX_METADATA_RESPONSE_BYTES,
  MAX_RESPONSE_BYTES,
  readLimitedBody,
  readLimitedBytes,
  readLimitedJson,
  responseTooLarge,
} from './bodyAdapters.js';

export function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
