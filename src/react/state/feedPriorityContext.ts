import { createContext } from 'react';

import type { FeedPriorities } from './feedPriority';

export type FeedPriorityValue = {
  isEnabled: boolean;
  priorities: FeedPriorities;
  changePriority: (feedId: number, delta: -1 | 1) => void;
  setEnabled: (isEnabled: boolean) => void;
};

export const FeedPriorityContext = createContext<FeedPriorityValue>({
  isEnabled: true,
  priorities: {},
  changePriority: () => undefined,
  setEnabled: () => undefined,
});
