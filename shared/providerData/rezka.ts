import { isRecord } from '../valueGuards.js';

export const REZKA_DETAIL_LABELS = new Set(['Рейтинги', 'Дата выхода', 'Жанр', 'Из серии']);

export type RezkaProviderData = {
  provider: 'rezka';
  details: { label: string; value: string }[];
};

export function isRezkaProviderData(value: unknown): value is RezkaProviderData {
  return isRecord(value) && value.provider === 'rezka' && Array.isArray(value.details)
    && value.details.every((detail: unknown) => isRecord(detail)
      && typeof detail.label === 'string' && typeof detail.value === 'string');
}
