import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import './styles.css';
import { FeedCreator } from './react/components/FeedCreator';
import { FeedsList } from './react/components/FeedsList';
import { Navbar } from './react/components/Navbar';
import { RequireAuth } from './react/components/RequireAuth';
import { FeedPage } from './react/pages/FeedPage';
import { LoginPage } from './react/pages/LoginPage';
import { AuthProvider } from './react/state/AuthContext';
import { FeedSearchProvider } from './react/state/FeedSearchContext';

function FeedListPage() {
  return (
    <section aria-labelledby="feeds-page-title">
      <h1 id="feeds-page-title" className="page-title">Feed sources</h1>
      <FeedsList />
    </section>
  );
}

function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main');
    main?.focus();
    document.title = `${main?.querySelector('h1')?.textContent ?? 'GKFEED'} | GKFEED`;
  }, [pathname]);
  return null;
}

function App() {
  return (
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <FeedSearchProvider>
            <RouteEffects />
            <a className="skip-link" href="#main">Skip to content</a>
            <Navbar />
            <main id="main" tabIndex={-1}>
              <Routes>
                <Route path="/" element={<RequireAuth><FeedListPage /></RequireAuth>} />
                <Route path="/create" element={<RequireAuth><FeedCreator /></RequireAuth>} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/feed/:id" element={<RequireAuth><FeedPage /></RequireAuth>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </FeedSearchProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
