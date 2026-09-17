import { createContext } from 'react';

import type { FeedDecision } from './feedDecisions';
import type { FeedPriorities } from './feedPriority';

export type FeedPriorityValue = {
  isEnabled: boolean;
  priorities: FeedPriorities;
  effectivePriorities: FeedPriorities;
  changePriority: (feedId: number, delta: -1 | 1) => void;
  recordDecision: (decision: FeedDecision) => void;
  setEnabled: (isEnabled: boolean) => void;
};

export const FeedPriorityContext = createContext<FeedPriorityValue>({
  isEnabled: true,
  priorities: {},
  effectivePriorities: {},
  changePriority: () => undefined,
  recordDecision: () => undefined,
  setEnabled: () => undefined,
});
