import i18next from 'i18next';
import { initReactI18next, setI18n } from 'react-i18next';

import en from './locales/en';
import ru from './locales/ru';

export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function resolveLanguage(locale: string | undefined): SupportedLanguage {
  return locale?.toLowerCase().match(/^ru(?:-|$)/) ? 'ru' : 'en';
}

export function getInitialLanguage(): SupportedLanguage {
  return typeof navigator === 'undefined' ? 'en' : resolveLanguage(navigator.language);
}

export const i18n = i18next.createInstance();
setI18n(i18n);

void i18n
  .use(initReactI18next)
  .init({
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    resources: { en: { translation: en }, ru: { translation: ru } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    initAsync: false,
  });

export default i18n;
