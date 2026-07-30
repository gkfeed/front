import { NavLink, useLocation, useSearchParams } from 'react-router';

import { getReaderMode, type ReaderMode } from '../state/readerMode';
import { BrandMark } from './Icons';
import { ThemePicker } from './ThemePicker';

export function Navbar() {
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
    <nav className="nav" aria-label="Primary navigation">
      <NavLink className="nav__brand" to="/" aria-label="GKFEED home">
        <BrandMark />
        <span>GKFEED</span>
      </NavLink>
      <span className="nav__links" aria-label="Feed sections">
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/" end>List</NavLink>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/reader">Reader</NavLink>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/create">Create</NavLink>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/live">Live</NavLink>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/login">Login</NavLink>
      </span>
      <ThemePicker
        readerMode={isReader ? getReaderMode(location.search) : undefined}
        onReaderModeChange={isReader ? setReaderMode : undefined}
      />
    </nav>
  );
}
