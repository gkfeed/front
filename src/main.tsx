import { StrictMode } from 'react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';

import './styles.scss';
import { FeedCreator } from './react/components/FeedCreator';
import { FeedsList } from './react/components/FeedsList';
import { Navbar } from './react/components/Navbar';
import { FeedCard } from './react/components/FeedCard';
import { useFeed } from './react/hooks/useFeed';
import { AuthProvider } from './react/state/AuthContext';
import { FeedSearchProvider } from './react/state/FeedSearchContext';

function FeedPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { feed, isLoading, isDeleting, isConfirmingDelete, loadError, deleteError, requestDelete, cancelDelete, deleteFeed } = useFeed(id, () => navigate('/'));

  return (
    <section className="container" aria-labelledby="feed-page-title">
      <h1 id="feed-page-title" className="page-title">Feed source details</h1>

      {isLoading ? (
        <p className="status" aria-live="polite">Loading feed source</p>
      ) : loadError ? (
        <p className="status status--error" role="alert">{loadError}</p>
      ) : feed ? (
        <>
          <FeedCard feed={feed} asLink={false} />
          <div className="actions">
            {isConfirmingDelete ? (
              <>
                <p className="status" id="delete-confirmation">Delete this feed source? This cannot be undone.</p>
                <div className="actions__confirm" aria-describedby="delete-confirmation">
                  <button type="button" className="secondary" onClick={cancelDelete} disabled={isDeleting}>
                    Cancel
                  </button>
                  <button type="button" onClick={deleteFeed} className="delete" disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete feed source'}
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={requestDelete} className="delete" disabled={isDeleting}>
                Delete
              </button>
            )}
            {deleteError ? (
              <p className="status status--error" role="alert">{deleteError}</p>
            ) : isDeleting ? (
              <p className="status" aria-live="polite">Deleting feed source</p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

function FeedListPage() {
  return (
    <section aria-labelledby="feeds-page-title">
      <h1 id="feeds-page-title" className="page-title">Feed sources</h1>
      <FeedsList />
    </section>
  );
}

function LoginPage() {
  const { credentials, saveCredentials, clearCredentials } = useAuthPageState();
  const [form, setForm] = useState({ username: '', password: '' });
  const [submitted, setSubmitted] = useState(false);
  const savedUsername = credentials?.username ?? '';
  const isValid = Boolean(form.username.trim() && form.password);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!isValid) return;

    saveCredentials(form);
    setForm({ username: '', password: '' });
    setSubmitted(false);
  }

  function onLogout() {
    clearCredentials();
    setForm({ username: '', password: '' });
    setSubmitted(false);
  }

  return (
    <section className="login" aria-labelledby="login-title">
      {savedUsername ? (
        <div className="login__form login__form--saved">
          <header className="login__header">
            <h1 id="login-title">Account access</h1>
          </header>
          <div className="field__control">
            <span className="field__icon" aria-hidden="true">
              <UserIcon />
            </span>
            <span>Logged in as <strong>{savedUsername}</strong></span>
          </div>
          <div className="login__actions">
            <button type="button" className="danger" onClick={onLogout}>Log out</button>
          </div>
        </div>
      ) : (
        <form className="login__form" onSubmit={onSubmit} noValidate>
          <header className="login__header">
            <p className="login__eyebrow">Account access</p>
            <h1 id="login-title">Sign in to GKFEED</h1>
          </header>
          <div className="login__fields">
            <div className="field">
              <label htmlFor="username">Username</label>
              <div className="field__control">
                <span className="field__icon" aria-hidden="true"><UserIcon /></span>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  autoComplete="username"
                  placeholder="gakawarstone"
                  aria-describedby={submitted && !form.username.trim() ? 'username-help username-error' : 'username-help'}
                  aria-invalid={submitted && !form.username.trim() ? 'true' : undefined}
                  required
                />
              </div>
              <p id="username-help" className="field__hint">Required. Enter your username.</p>
              {submitted && !form.username.trim() ? <p id="username-error" className="field__error">Enter your username.</p> : null}
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="field__control">
                <span className="field__icon" aria-hidden="true"><LockIcon /></span>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  autoComplete="current-password"
                  aria-describedby={submitted && !form.password ? 'password-help password-error' : 'password-help'}
                  aria-invalid={submitted && !form.password ? 'true' : undefined}
                  required
                />
              </div>
              <p id="password-help" className="field__hint">Required. Enter your password.</p>
              {submitted && !form.password ? <p id="password-error" className="field__error">Enter your password.</p> : null}
            </div>
          </div>
          <div className="login__actions">
            <span className="login__status" aria-live="polite">{isValid ? 'Ready to save' : 'Enter credentials'}</span>
            <button type="submit" disabled={!isValid}>Save login</button>
          </div>
        </form>
      )}
    </section>
  );
}

function App() {
  return (
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <FeedSearchProvider>
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<FeedListPage />} />
                <Route path="/create" element={<FeedCreator />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/feed/:id" element={<FeedPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </FeedSearchProvider>
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

import { useAuth } from './react/state/AuthContext';
import { LockIcon, UserIcon } from './react/components/Icons';

function useAuthPageState() {
  return useAuth();
}

createRoot(document.getElementById('root')!).render(<App />);
