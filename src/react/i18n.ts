import i18next from 'i18next';
import { initReactI18next, setI18n } from 'react-i18next';

export const SUPPORTED_LANGUAGES = ['en', 'ru'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type LocaleResources = Record<string, unknown>;
type LocaleLoader = () => Promise<{ default: LocaleResources }>;

const localeLoaders: Record<SupportedLanguage, LocaleLoader> = {
  en: () => import('./locales/en'),
  ru: () => import('./locales/ru'),
};

export function resolveLanguage(locale: string | undefined): SupportedLanguage {
  return locale?.toLowerCase().match(/^ru(?:-|$)/) ? 'ru' : 'en';
}

export function getInitialLanguage(): SupportedLanguage {
  return typeof navigator === 'undefined' ? 'en' : resolveLanguage(navigator.language);
}

export const i18n = i18next.createInstance();
setI18n(i18n);

const localeBackend = {
  type: 'backend' as const,
  init: () => {},
  read: (
    language: string,
    _namespace: string,
    callback: (error: Error | null, resources: LocaleResources | null) => void,
  ) => {
    localeLoaders[resolveLanguage(language)]()
      .then(({ default: resources }) => callback(null, resources))
      .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error)), null));
  },
};

export const i18nReady = i18n
  .use(localeBackend)
  .use(initReactI18next)
  .init({
    lng: getInitialLanguage(),
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    backend: {},
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
