import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface FeedSearchContextValue {
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
}

const FeedSearchContext = createContext<FeedSearchContextValue | null>(null);

export function FeedSearchProvider({ children }: { children: ReactNode }) {
  const [searchTerm, setSearchTerm] = useState('');
  const value = useMemo(() => ({ searchTerm, setSearchTerm }), [searchTerm]);

  return <FeedSearchContext value={value}>{children}</FeedSearchContext>;
}

export function useFeedSearch(): FeedSearchContextValue {
  const value = useContext(FeedSearchContext);
  if (!value) throw new Error('useFeedSearch must be used inside FeedSearchProvider');
  return value;
}
