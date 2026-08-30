import { useTranslation } from 'react-i18next';

import '../../styles/login.css';
import { useLoginPageModel } from '../adapters/auth/useLoginPageModel';
import { LoginForm } from '../components/LoginForm';
import { SavedLogin } from '../components/SavedLogin';

export function LoginPage() {
  const { t } = useTranslation();
  const { status, savedUsername, clearCredentials, loginForm } = useLoginPageModel();

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
