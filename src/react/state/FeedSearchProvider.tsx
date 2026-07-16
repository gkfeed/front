import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { FeedSearchContext } from './feedSearchContext';

export function FeedSearchProvider({ children }: { children: ReactNode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const value = useMemo(() => ({ searchTerm, setSearchTerm }), [searchTerm]);

  return <FeedSearchContext value={value}>{children}</FeedSearchContext>;
}
