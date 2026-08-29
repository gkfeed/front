import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

import { Navbar } from './react/components/Navbar';
import { RequireAuth } from './react/components/RequireAuth';
import { AuthProvider } from './react/state/AuthProvider';
import { NsfwPreferencesProvider } from './react/state/NsfwPreferencesProvider';
import { useAuth } from './react/state/useAuth';

const FeedListPage = lazy(() => import('./react/pages/FeedListPage').then(({ FeedListPage: page }) => ({ default: page })));
const FeedCreator = lazy(() => import('./react/components/FeedCreator').then(({ FeedCreator: page }) => ({ default: page })));
const FeedPage = lazy(() => import('./react/pages/FeedPage').then(({ FeedPage: page }) => ({ default: page })));
const LoginPage = lazy(() => import('./react/pages/LoginPage').then(({ LoginPage: page }) => ({ default: page })));
const LivePage = lazy(() => import('./react/pages/LivePage').then(({ LivePage: page }) => ({ default: page })));
const ReaderPage = lazy(() => import('./react/pages/ReaderPage').then(({ ReaderPage: page }) => ({ default: page })));

function RouteEffects() {
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

export function App() {
  const { i18n, t } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n, i18n.language]);

  return (
    <BrowserRouter>
      <AuthProvider>
        <NsfwPreferencesProvider>
          <RouteEffects />
          <a className="skip-link" href="#main">{t('app.skipToContent')}</a>
          <Navbar />
          <main id="main" tabIndex={-1}>
            <Suspense fallback={<p className="ui-status" role="status">{t('app.loading')}</p>}>
              <Routes>
                <Route path="/" element={<RequireAuth><FeedListPage /></RequireAuth>} />
                <Route path="/create" element={<RequireAuth><FeedCreator /></RequireAuth>} />
                <Route path="/reader" element={<RequireAuth><ReaderPage /></RequireAuth>} />
                <Route path="/live" element={<RequireAuth><LivePage /></RequireAuth>} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/feed/:id" element={<RequireAuth><FeedPage /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>
        </NsfwPreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
