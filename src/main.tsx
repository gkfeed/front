import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
import { App } from './App';
import { i18n } from './react/i18n';
import { applyThemePreference, getInitialThemePreference } from './react/theme';
import { I18nextProvider } from 'react-i18next';

applyThemePreference(getInitialThemePreference());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>,
);
