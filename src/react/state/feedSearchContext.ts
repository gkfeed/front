import { createContext } from 'react';

export interface FeedSearchContextValue {
  searchTerm: string;
  setSearchTerm: (searchTerm: string) => void;
}

export const FeedSearchContext = createContext<FeedSearchContextValue | null>(null);
