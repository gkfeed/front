import { use } from 'react';

import { FeedPriorityContext } from './feedPriorityContext';

export function useFeedPriority() {
  return use(FeedPriorityContext);
}
