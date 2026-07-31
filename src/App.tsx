import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

import { FeedCreator } from './react/components/FeedCreator';
import { FeedsList } from './react/components/FeedsList';
import { Navbar } from './react/components/Navbar';
import { RequireAuth } from './react/components/RequireAuth';
import { FeedPage } from './react/pages/FeedPage';
import { LoginPage } from './react/pages/LoginPage';
import { LivePage } from './react/pages/LivePage';
import { ReaderPage } from './react/pages/ReaderPage';
import { AuthProvider } from './react/state/AuthProvider';
import { NsfwPreferencesProvider } from './react/state/NsfwPreferencesProvider';
import { useAuth } from './react/state/useAuth';

function FeedListPage() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="feeds-page-title">
      <h1 id="feeds-page-title" className="page-title">{t('pages.feedSources')}</h1>
      <FeedsList />
    </section>
  );
}

function RouteEffects() {
  const { pathname } = useLocation();
  const { status } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main');
    main?.focus();
    document.title = `${main?.querySelector('h1')?.textContent ?? t('app.fallbackTitle')} | GKFEED`;
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
            <Routes>
              <Route path="/" element={<RequireAuth><FeedListPage /></RequireAuth>} />
              <Route path="/create" element={<RequireAuth><FeedCreator /></RequireAuth>} />
              <Route path="/reader" element={<RequireAuth><ReaderPage /></RequireAuth>} />
              <Route path="/live" element={<RequireAuth><LivePage /></RequireAuth>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/feed/:id" element={<RequireAuth><FeedPage /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </NsfwPreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
