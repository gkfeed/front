import { NavLink, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

import { BrandMark } from './Icons';
import { ReaderFullscreenButton } from './ReaderFullscreenButton';

export function Navbar() {
  const { t } = useTranslation();
  const location = useLocation();
  const isReader = location.pathname === '/reader';

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
        <NavLink
          className="theme-picker__trigger"
          to="/settings"
          aria-label={t('settings.button')}
        >
          <svg className="theme-picker__gear" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.7 2.8h4.6l.7 2.5c.5.2 1 .5 1.5.9l2.5-.7 2.3 4-1.9 1.8v1.8l1.9 1.8-2.3 4-2.5-.7c-.5.4-1 .7-1.5.9l-.7 2.5H9.7L9 19.1c-.5-.2-1-.5-1.5-.9l-2.5.7-2.3-4 1.9-1.8v-1.8L2.7 9.5l2.3-4 2.5.7c.5-.4 1-.7 1.5-.9l.7-2.5Z" />
            <circle cx="12" cy="12.2" r="3.1" />
          </svg>
        </NavLink>
      </div>
    </nav>
  );
}
