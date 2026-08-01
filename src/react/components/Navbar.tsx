import { NavLink, useLocation, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { getReaderMode, type ReaderMode } from '../state/readerMode';
import { BrandMark } from './Icons';
import { ReaderFullscreenButton } from './ReaderFullscreenButton';
import { SettingsMenu } from './SettingsMenu';

export function Navbar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const isReader = location.pathname === '/reader';

  function setReaderMode(mode: ReaderMode) {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      if (mode === 'review') nextParams.delete('view');
      else nextParams.set('view', mode);
      return nextParams;
    });
  }

  return (
    <nav className="nav" aria-label={t('nav.primary')}>
      <NavLink className="nav__brand" to="/" aria-label={t('nav.home')}>
        <BrandMark />
        <span>GKFEED</span>
      </NavLink>
      <span className="nav__links" aria-label={t('nav.sections')}>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/" end>{t('nav.list')}</NavLink>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/reader">{t('nav.reader')}</NavLink>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/create">{t('nav.create')}</NavLink>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/live">{t('nav.live')}</NavLink>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/login">{t('nav.login')}</NavLink>
      </span>
      <div className="nav__tools">
        {isReader ? <ReaderFullscreenButton /> : null}
        <SettingsMenu
          readerMode={isReader ? getReaderMode(location.search) : undefined}
          onReaderModeChange={isReader ? setReaderMode : undefined}
        />
      </div>
    </nav>
  );
}
