import { createContext } from 'react';

import type { FeedDecision, FeedPriorities } from './feedPriority';

export type FeedPriorityValue = {
  isEnabled: boolean;
  priorities: FeedPriorities;
  smartPriorities: FeedPriorities;
  decisions: readonly FeedDecision[];
  changePriority: (feedId: number, delta: -1 | 1) => void;
  recordDecision: (decision: FeedDecision) => void;
  setEnabled: (isEnabled: boolean) => void;
};

export const FeedPriorityContext = createContext<FeedPriorityValue>({
  isEnabled: true,
  priorities: {},
  smartPriorities: {},
  decisions: [],
  changePriority: () => undefined,
  recordDecision: () => undefined,
  setEnabled: () => undefined,
});
