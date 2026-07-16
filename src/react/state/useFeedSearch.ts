import { useContext } from 'react';

import { FeedSearchContext } from './feedSearchContext';
import type { FeedSearchContextValue } from './feedSearchContext';

export function useFeedSearch(): FeedSearchContextValue {
  const value = useContext(FeedSearchContext);
  if (!value) throw new Error('useFeedSearch must be used inside FeedSearchProvider');
  return value;
}
