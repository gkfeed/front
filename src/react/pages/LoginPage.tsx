import { useTranslation } from 'react-i18next';

import '../../styles/login.css';
import { useLoginPageModel } from '../adapters/auth/useLoginPageModel';
import { LoginForm } from '../components/LoginForm';
import { SavedLogin } from '../components/SavedLogin';

export function LoginPage() {
  const { t } = useTranslation();
  const { status, savedUsername, retrySavedLogin, clearCredentials, loginForm } = useLoginPageModel();

  if (status === 'checking') {
    return <section className="login"><div className="login__form"><p role="status">{t('auth.checking')}</p></div></section>;
  }

  if (status === 'restore-error') {
    return (
      <section className="login" aria-labelledby="login-title">
        <div className="login__form">
          <h1 id="login-title" className="page-title">{t('auth.signInTitle')}</h1>
          <p role="alert">{t('auth.restoreError')}</p>
          <div className="login__actions">
            <button type="button" className="ui-primary-button" onClick={() => void retrySavedLogin()}>{t('auth.retryRestore')}</button>
            <button type="button" className="ui-primary-button" onClick={clearCredentials}>{t('auth.useAnotherAccount')}</button>
          </div>
        </div>
      </section>
    );
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
