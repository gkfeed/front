import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
import { App } from './App';
import { applyThemePreference, getInitialThemePreference } from './react/theme';

applyThemePreference(getInitialThemePreference());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
