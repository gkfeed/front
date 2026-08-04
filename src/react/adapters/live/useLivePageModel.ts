import { useCallback, useMemo, useState } from 'react';

import type { FeedItem } from '../../types';
import { useLiveTwitchStreams } from './useLiveTwitchStreams';
import { toLiveStreamViewModel, type LiveStreamViewModel } from '../../features/live/liveViewModel';

type Translator = (key: string) => string;

export function useLivePageModel(t: Translator) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const resource = useLiveTwitchStreams(t);
  const streams = useMemo(
    () => resource.result?.map(toLiveStreamViewModel),
    [resource.result],
  );
  const selectedStream = streams?.find((stream) => stream.item.id === selectedId) ?? streams?.[0];

  const selectChannel = useCallback((id: number) => {
    setSelectedId(id);
    setPlayingId(null);
  }, []);

  const playChannel = useCallback((item: FeedItem) => {
    setPlayingId(item.id);
  }, []);

  return {
    ...resource,
    streams,
    selectedStream,
    playingId,
    selectChannel,
    playChannel,
  } satisfies {
    streams: LiveStreamViewModel[] | undefined;
    selectedStream: LiveStreamViewModel | undefined;
    playingId: number | null;
    selectChannel: (id: number) => void;
    playChannel: (item: FeedItem) => void;
  };
}
