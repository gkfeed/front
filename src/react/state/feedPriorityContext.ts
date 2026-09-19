import { createContext } from 'react';

import type { FeedPriorities } from './feedPriority';

export type FeedPriorityValue = {
  isManualEnabled: boolean;
  isAutomaticEnabled: boolean;
  priorities: FeedPriorities;
  changePriority: (feedId: number, delta: -1 | 1) => void;
  setManualEnabled: (isEnabled: boolean) => void;
  setAutomaticEnabled: (isEnabled: boolean) => void;
};

export const FeedPriorityContext = createContext<FeedPriorityValue>({
  isManualEnabled: true,
  isAutomaticEnabled: true,
  priorities: {},
  changePriority: () => undefined,
  setManualEnabled: () => undefined,
  setAutomaticEnabled: () => undefined,
});
