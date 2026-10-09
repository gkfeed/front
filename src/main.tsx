import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
import { App } from './App';
import { i18n, i18nReady } from './react/i18n';
import { applyThemePreference, getInitialThemePreference } from './react/theme';
import { I18nextProvider } from 'react-i18next';

async function prepareDevelopmentFixture() {
  if (import.meta.env.DEV && (new URLSearchParams(window.location.search).has('fixture')
    || window.location.pathname.startsWith('/__verify/'))) {
    const { installReaderFixture } = await import('./dev/readerFixture');
    return { basename: await installReaderFixture() };
  }
  return {};
}

applyThemePreference(getInitialThemePreference());

void prepareDevelopmentFixture().then(async (options) => {
  await i18nReady;
  applyThemePreference(getInitialThemePreference());
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <App {...options} />
      </I18nextProvider>
    </StrictMode>,
  );
}).catch((error: unknown) => {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = error instanceof Error ? error.message : 'Application startup failed';
  document.getElementById('root')!.replaceChildren(message);
  console.error(error);
});
