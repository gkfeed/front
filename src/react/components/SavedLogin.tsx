import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { UserIcon } from './Icons';

export function SavedLogin({ username, onLogout }: { username: string; onLogout: () => void }) {
  const { t } = useTranslation();
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);

  return (
    <div className="login__form login__form--saved">
      <h1 id="login-title" className="page-title">{t('auth.signedIn')}</h1>
      <div className="login__account" role="status">
        <span className="field__icon" aria-hidden="true"><UserIcon /></span>
        <span className="login__account-copy">
          {t('auth.loggedInAs')} <strong>{username}</strong>
        </span>
      </div>
      {isConfirmingLogout ? (
        <div className="login__logout-confirmation" role="group" aria-labelledby="logout-confirmation">
          <p id="logout-confirmation">{t('auth.logoutQuestion')}</p>
          <div className="login__actions">
            <button type="button" className="login__cancel" autoFocus onClick={() => setIsConfirmingLogout(false)}>{t('auth.cancel')}</button>
            <button type="button" className="danger" onClick={onLogout}>{t('auth.yesLogout')}</button>
          </div>
        </div>
      ) : (
        <div className="login__actions">
          <button type="button" className="danger" onClick={() => setIsConfirmingLogout(true)}>{t('auth.logout')}</button>
        </div>
      )}
    </div>
  );
}
