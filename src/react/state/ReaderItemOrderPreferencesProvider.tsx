import { useCallback, useMemo, useState, type ReactNode } from 'react';

import {
  READER_ITEM_ORDER_STORAGE_KEY,
  type ReaderItemOrder,
} from './readerItemOrder';
import { ReaderItemOrderPreferencesContext } from './readerItemOrderPreferencesContext';

export function ReaderItemOrderPreferencesProvider({ children }: { children: ReactNode }) {
  const [itemOrder, setItemOrderState] = useState(readReaderItemOrderPreference);

  const setItemOrder = useCallback((nextOrder: ReaderItemOrder) => {
    setItemOrderState(nextOrder);
    try {
      window.localStorage.setItem(READER_ITEM_ORDER_STORAGE_KEY, nextOrder);
    } catch {
      // Keep the in-memory preference usable when storage is unavailable.
    }
  }, []);

  const value = useMemo(() => ({
    itemOrder,
    setItemOrder,
  }), [itemOrder, setItemOrder]);

  return (
    <ReaderItemOrderPreferencesContext value={value}>
      {children}
    </ReaderItemOrderPreferencesContext>
  );
}

function readReaderItemOrderPreference(): ReaderItemOrder {
  if (typeof window === 'undefined') return 'desc';

  try {
    return window.localStorage.getItem(READER_ITEM_ORDER_STORAGE_KEY) === 'asc' ? 'asc' : 'desc';
  } catch {
    return 'desc';
  }
}
