import { createContext } from 'react';

import type { FeedPriorities } from './feedPriority';

export type FeedPriorityValue = {
  priorities: FeedPriorities;
  changePriority: (feedId: number, delta: -1 | 1) => void;
};

export const FeedPriorityContext = createContext<FeedPriorityValue>({
  priorities: {},
  changePriority: () => undefined,
});
