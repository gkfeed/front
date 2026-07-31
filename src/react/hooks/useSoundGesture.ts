import { useCallback, useEffect, useState } from 'react';

export interface SoundGestureLifecycle {
  isMuted: boolean;
  showPrompt: boolean;
  enableSound: () => void;
}

interface SoundGestureState {
  mediaKey: string;
  requiresGesture: boolean;
  enabled: boolean;
}

export function useSoundGesture(
  requiresGesture: boolean,
  mediaKey: string,
): SoundGestureLifecycle {
  const [state, setState] = useState<SoundGestureState>(() => createInitialState(requiresGesture, mediaKey));
  const isCurrentMedia = state.mediaKey === mediaKey && state.requiresGesture === requiresGesture;
  const enabled = isCurrentMedia ? state.enabled : !requiresGesture;
  const isMuted = requiresGesture && !enabled;

  useEffect(() => {
    setState(createInitialState(requiresGesture, mediaKey));
  }, [mediaKey, requiresGesture]);

  const enableSound = useCallback(() => {
    setState({ mediaKey, requiresGesture, enabled: true });
  }, [mediaKey, requiresGesture]);

  return {
    isMuted,
    showPrompt: isMuted,
    enableSound,
  };
}

function createInitialState(requiresGesture: boolean, mediaKey: string): SoundGestureState {
  return {
    mediaKey,
    requiresGesture,
    enabled: !requiresGesture,
  };
}
