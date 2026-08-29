import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import '../../styles/login.css';
import { LoginForm } from '../components/LoginForm';
import { SavedLogin } from '../components/SavedLogin';
import { useLoginForm } from '../hooks/useLoginForm';
import { useAuth } from '../state/useAuth';
import { getRedirectTarget } from '../state/routes';

export function LoginPage() {
  const { t } = useTranslation();
  const { credentials, status, authenticate, clearCredentials } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTo = getRedirectTarget(location.state);
  const onAuthenticated = useCallback(() => {
    navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo]);
  const loginForm = useLoginForm({ authenticate, onAuthenticated });
  const savedUsername = credentials?.username ?? '';

  if (status === 'checking') {
    return <section className="login"><div className="login__form"><p role="status">{t('auth.checking')}</p></div></section>;
  }

  return (
    <section className="login" aria-labelledby="login-title">
      {savedUsername ? (
        <SavedLogin username={savedUsername} onLogout={clearCredentials} />
      ) : (
        <LoginForm {...loginForm} />
      )}
    </section>
  );
}
