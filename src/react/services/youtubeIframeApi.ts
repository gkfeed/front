export type YoutubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  setPlaybackRate: (playbackRate: number) => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo: () => void;
  destroy: () => void;
};

export type YoutubePlayerReadyEvent = {
  target: YoutubePlayer;
};

export type YoutubePlayerStateChangeEvent = {
  data: number;
  target: YoutubePlayer;
};

export type YoutubePlayerErrorEvent = {
  data: number;
  target: YoutubePlayer;
};

type YoutubePlayerEvents = {
  onError: (event: YoutubePlayerErrorEvent) => void;
  onReady: (event: YoutubePlayerReadyEvent) => void;
  onStateChange: (event: YoutubePlayerStateChangeEvent) => void;
};

type YoutubeIframeApi = {
  Player: new (
    iframe: HTMLIFrameElement,
    options: { events: YoutubePlayerEvents },
  ) => YoutubePlayer;
};

declare global {
  interface Window {
    YT?: YoutubeIframeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';
let youtubeIframeApiPromise: Promise<YoutubeIframeApi> | null = null;

export function loadYoutubeIframeApi(): Promise<YoutubeIframeApi> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('YouTube IFrame API requires a browser'));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeIframeApiPromise) return youtubeIframeApiPromise;

  const promise = new Promise<YoutubeIframeApi>((resolve, reject) => {
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    const fail = (message: string, script: HTMLScriptElement | null) => {
      script?.remove();
      if (window.onYouTubeIframeAPIReady === onReady) {
        window.onYouTubeIframeAPIReady = previousReadyHandler;
      }
      reject(new Error(message));
    };
    const onReady = () => {
      previousReadyHandler?.();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        fail('YouTube IFrame API did not initialize', document.querySelector(
          `script[src="${YOUTUBE_IFRAME_API_SRC}"]`,
        ));
      }
    };
    window.onYouTubeIframeAPIReady = onReady;

    const onScriptError = (script: HTMLScriptElement) => {
      fail('Failed to load YouTube IFrame API', script);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${YOUTUBE_IFRAME_API_SRC}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener('error', () => onScriptError(existingScript), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = YOUTUBE_IFRAME_API_SRC;
    script.async = true;
    script.addEventListener('error', () => onScriptError(script), {
      once: true,
    });
    document.head.appendChild(script);
  });

  youtubeIframeApiPromise = promise;
  void promise.catch(() => {
    if (youtubeIframeApiPromise === promise) youtubeIframeApiPromise = null;
  });
  return promise;
}
