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

  return <FeedSearchContext.Provider value={value}>{children}</FeedSearchContext.Provider>;
}

export function useFeedSearch(): FeedSearchContextValue {
  const context = useContext(FeedSearchContext);
  if (!context) throw new Error('useFeedSearch must be used inside FeedSearchProvider');
  return context;
}
