import { lazy, Profiler, Suspense, useEffect } from 'react';
import { readerDiagnostic } from './react/services/readerDiagnostics';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Navbar } from './react/components/Navbar';
import { RequireAuth } from './react/components/RequireAuth';
import { AppProviders } from './react/state/AppProviders';
import { NsfwPreferencesProvider } from './react/state/NsfwPreferencesProvider';
import { ReaderItemOrderPreferencesProvider } from './react/state/ReaderItemOrderPreferencesProvider';
import { TikTokPreferencesProvider } from './react/state/TikTokPreferencesProvider';
import { PluginPreferencesProvider } from './react/state/PluginPreferencesProvider';
import { useAuth } from './react/state/useAuth';
import { usePluginCatalogPolicy } from './react/hooks/usePluginCatalogPolicy';

const FeedListPage = lazy(() => import('./react/pages/FeedListPage').then(({ FeedListPage: page }) => ({ default: page })));
const FeedScoresPage = lazy(() => import('./react/pages/FeedScoresPage').then(({ FeedScoresPage: page }) => ({ default: page })));
const CreateFeedPage = lazy(() => import('./react/pages/CreateFeedPage').then(({ CreateFeedPage: page }) => ({ default: page })));
const FeedPage = lazy(() => import('./react/pages/FeedPage').then(({ FeedPage: page }) => ({ default: page })));
const LoginPage = lazy(() => import('./react/pages/LoginPage').then(({ LoginPage: page }) => ({ default: page })));
const LivePage = lazy(() => import('./react/pages/LivePage').then(({ LivePage: page }) => ({ default: page })));
const ReaderPage = lazy(() => import('./react/pages/ReaderPage').then(({ ReaderPage: page }) => ({ default: page })));
const SettingsPage = lazy(() => import('./react/pages/SettingsPage').then(({ SettingsPage: page }) => ({ default: page })));

function RouteEffects() {
  usePluginCatalogPolicy();
  const { pathname } = useLocation();
  const { status } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main');
    main?.focus();
    const updateTitle = () => {
      document.title = `${main?.querySelector('h1')?.textContent ?? t('app.fallbackTitle')} | GKFEED`;
    };
    updateTitle();
    if (!main) return undefined;
    const observer = new MutationObserver(updateTitle);
    observer.observe(main, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname, status, t]);

  return null;
}

export function App({ basename }: { basename?: string } = {}) {
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const supportsLongTask = typeof PerformanceObserver !== 'undefined'
      && !!PerformanceObserver.supportedEntryTypes?.includes('longtask');
    readerDiagnostic('browser-diagnostics', 'unknown', `longtask=${supportsLongTask}:firefox=${/Firefox\//.test(navigator.userAgent)}`);
    if (!supportsLongTask) return undefined;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        readerDiagnostic('browser-long-task', 'unknown', `duration=${Math.round(entry.duration)}:start=${Math.round(performance.timeOrigin + entry.startTime)}`);
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n, i18n.language]);

  return (
    <BrowserRouter basename={basename}>
      <AppProviders>
        <NsfwPreferencesProvider>
          <PluginPreferencesProvider>
            <TikTokPreferencesProvider>
              <ReaderItemOrderPreferencesProvider>
              <RouteEffects />
              <a className="skip-link" href="#main">{t('app.skipToContent')}</a>
              <Navbar />
              <main id="main" tabIndex={-1}>
                <Suspense fallback={<p className="ui-status" role="status">{t('app.loading')}</p>}>
                  <Routes>
                    <Route path="/" element={<RequireAuth><FeedListPage /></RequireAuth>} />
                    <Route path="/scores" element={<RequireAuth><FeedScoresPage /></RequireAuth>} />
                    <Route path="/create" element={<RequireAuth><CreateFeedPage /></RequireAuth>} />
                    <Route path="/reader" element={<RequireAuth>{import.meta.env.DEV ? (
                      <Profiler id="reader" onRender={(_id, phase, actualDuration, baseDuration) => {
                        readerDiagnostic('reader-render', 'unknown', `${phase}:actual=${Math.round(actualDuration)}:base=${Math.round(baseDuration)}`);
                      }}><ReaderPage /></Profiler>
                    ) : <ReaderPage />}</RequireAuth>} />
                    <Route path="/live" element={<RequireAuth><LivePage /></RequireAuth>} />
                    <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/feed/:id" element={<RequireAuth><FeedPage /></RequireAuth>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </main>
              </ReaderItemOrderPreferencesProvider>
            </TikTokPreferencesProvider>
          </PluginPreferencesProvider>
        </NsfwPreferencesProvider>
      </AppProviders>
    </BrowserRouter>
  );
}
