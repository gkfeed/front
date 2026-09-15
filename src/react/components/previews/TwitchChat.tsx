import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function TwitchChat({ channel }: { channel: string }) {
  const { t } = useTranslation();
  const colorScheme = useDocumentColorScheme();
  const parameters = new URLSearchParams({
    parent: window.location.hostname || 'localhost',
  });
  if (colorScheme === 'dark') parameters.set('darkpopout', 'true');

  return (
    <iframe
      id={`twitch-chat-${channel}`}
      className="twitch-chat"
      src={`https://www.twitch.tv/embed/${encodeURIComponent(channel)}/chat?${parameters}`}
      title={t('preview.twitchChat', { channel })}
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function useDocumentColorScheme(): 'light' | 'dark' {
  const [colorScheme, setColorScheme] = useState(readDocumentColorScheme);

  useEffect(() => {
    const root = document.documentElement;
    const syncColorScheme = () => setColorScheme(readDocumentColorScheme());
    const observer = new MutationObserver(syncColorScheme);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    return () => observer.disconnect();
  }, []);

  return colorScheme;
}

function readDocumentColorScheme(): 'light' | 'dark' {
  const root = document.documentElement;
  if (root.style.colorScheme === 'dark' || root.style.colorScheme === 'light') {
    return root.style.colorScheme;
  }
  const theme = root.dataset.theme;
  return theme === 'dark' || theme === 'mocha' ? 'dark' : 'light';
}
