import { createContext } from 'react';

import type { ReaderItemOrder } from './readerItemOrder';

export type ReaderItemOrderPreferencesValue = {
  itemOrder: ReaderItemOrder;
  setItemOrder: (order: ReaderItemOrder) => void;
};

export const ReaderItemOrderPreferencesContext = createContext<ReaderItemOrderPreferencesValue>({
  itemOrder: 'desc',
  setItemOrder: () => undefined,
});
