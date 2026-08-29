export type SpotifyEmbedController = {
  play: () => void;
  destroy: () => void;
};

type SpotifyEmbedOptions = {
  url: string;
  width: string | number;
  height: string | number;
};

export type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: SpotifyEmbedOptions,
    callback: (controller: SpotifyEmbedController) => void,
  ) => void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void;
  }
}

const SPOTIFY_IFRAME_API_SRC = 'https://open.spotify.com/embed/iframe-api/v1';
let spotifyIframeApiPromise: Promise<SpotifyIframeApi> | null = null;
let cachedSpotifyApi: SpotifyIframeApi | null = null;

export function loadSpotifyIframeApi(): Promise<SpotifyIframeApi> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Spotify IFrame API requires a browser'));
  }
  if (cachedSpotifyApi) return Promise.resolve(cachedSpotifyApi);
  if (spotifyIframeApiPromise) return spotifyIframeApiPromise;

  spotifyIframeApiPromise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const previousReadyHandler = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => {
      previousReadyHandler?.(api);
      cachedSpotifyApi = api;
      resolve(api);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${SPOTIFY_IFRAME_API_SRC}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener(
        'error',
        () => {
          spotifyIframeApiPromise = null;
          reject(new Error('Failed to load Spotify IFrame API'));
        },
        { once: true },
      );
      // Script already in DOM may have already fired onSpotifyIframeApiReady before
      // we installed our handler, or it may be still pending. If already cached,
      // resolve immediately. Otherwise, handle the missed-callback case by polling
      // and, if needed, re-injecting the script to trigger the callback again.
      if (cachedSpotifyApi) {
        resolve(cachedSpotifyApi);
        return;
      }
      // If the script has already completed loading, the load event won't fire again.
      // Schedule a short delay to detect a missed ready callback without racing
      // a pending script that is still loading.
      setTimeout(() => {
        if (cachedSpotifyApi) {
          resolve(cachedSpotifyApi);
          return;
        }
        // If still pending and the existing script is already loaded/completed,
        // the ready callback was missed. Re-inject to force a new callback.
        // We detect this by checking that the script is still connected and
        // no API has arrived shortly after installation.
        if (existingScript.isConnected && !cachedSpotifyApi) {
          // Avoid infinite loop: only re-inject if we haven't already retried.
          // Remove old script and append a fresh one which will invoke our handler.
          existingScript.remove();
          const script = document.createElement('script');
          script.src = SPOTIFY_IFRAME_API_SRC;
          script.async = true;
          script.addEventListener(
            'error',
            () => {
              spotifyIframeApiPromise = null;
              reject(new Error('Failed to load Spotify IFrame API'));
            },
            { once: true },
          );
          document.head.appendChild(script);
        }
      }, 50);
      return;
    }

    const script = document.createElement('script');
    script.src = SPOTIFY_IFRAME_API_SRC;
    script.async = true;
    script.addEventListener(
      'error',
      () => {
        spotifyIframeApiPromise = null;
        reject(new Error('Failed to load Spotify IFrame API'));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  spotifyIframeApiPromise.catch(() => {
    spotifyIframeApiPromise = null;
  });

  // Cache the resolved API for future synchronous returns after the promise fulfills.
  void spotifyIframeApiPromise.then((api) => {
    cachedSpotifyApi = api;
  });

  return spotifyIframeApiPromise;
}
