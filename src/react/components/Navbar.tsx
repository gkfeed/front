import { NavLink } from 'react-router-dom';

import { ThemePicker } from './ThemePicker';

export function Navbar() {
  return (
    <nav className="nav" aria-label="Primary navigation">
      <NavLink className="nav__brand" to="/" aria-label="GKFEED home">
        <img className="nav__brand-mark" src="/gkfeed-mark.svg" alt="" width="32" height="32" />
        <span>GKFEED</span>
      </NavLink>
      <span className="nav__links" aria-label="Feed sections">
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/" end>List</NavLink>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/create">Create</NavLink>
        <NavLink className={({ isActive }) => `nav__link${isActive ? ' nav__link--active' : ''}`} to="/login">Login</NavLink>
      </span>
      <ThemePicker />
    </nav>
  );
}
