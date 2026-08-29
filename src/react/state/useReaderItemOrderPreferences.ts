import { use } from 'react';

import { ReaderItemOrderPreferencesContext } from './readerItemOrderPreferencesContext';

export function useReaderItemOrderPreferences() {
  return use(ReaderItemOrderPreferencesContext);
}
