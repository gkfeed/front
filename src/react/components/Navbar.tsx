import { useState, useTransition } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { useFeedSearch } from '../state/FeedSearchContext';

export function Navbar() {
  const location = useLocation();
  const { searchTerm, setSearchTerm } = useFeedSearch();
  const [draftSearchTerm, setDraftSearchTerm] = useState(searchTerm);
  const [, startSearchTransition] = useTransition();
  const showSearch = location.pathname === '/';

  return (
    <nav className="nav" aria-label="Primary navigation">
      <NavLink className="nav-live-leftbar__brand" to="/" aria-label="GKFEED home">GKFEED</NavLink>
      <span className="nav-live-leftbar__links" aria-label="Feed sections">
        <NavLink className={({ isActive }) => `nav-live-leftbar__link${isActive ? ' nav-live-leftbar__link--active' : ''}`} to="/" end>List</NavLink>
        <NavLink className={({ isActive }) => `nav-live-leftbar__link${isActive ? ' nav-live-leftbar__link--active' : ''}`} to="/create">Create</NavLink>
        <NavLink className={({ isActive }) => `nav-live-leftbar__link${isActive ? ' nav-live-leftbar__link--active' : ''}`} to="/login">Login</NavLink>
      </span>
      {showSearch ? (
        <input
          className="nav-live-leftbar__search"
          type="search"
          placeholder="Search feeds"
          aria-label="Search feeds"
          value={draftSearchTerm}
          onChange={(event) => {
            const nextSearchTerm = event.target.value;
            setDraftSearchTerm(nextSearchTerm);
            startSearchTransition(() => setSearchTerm(nextSearchTerm));
          }}
        />
      ) : null}
    </nav>
  );
}
