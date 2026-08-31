import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import { NsfwPreferencesContext, type NsfwMode } from '../state/nsfwPreferencesContext';
import type { ReaderItemOrder } from '../state/readerItemOrder';
import { ReaderItemOrderPreferencesContext } from '../state/readerItemOrderPreferencesContext';
import { restoreLocalStorage } from '../testUtils';
import { ReaderPage } from './ReaderPage';

export const READER_ITEMS = [
  { id: 11, feedId: 2, link: 'https://example.com/one', title: 'First story', text: 'First summary' },
  { id: 10, feedId: 3, link: 'https://news.example.org/two', title: 'Second story', text: 'Second summary' },
];

export function renderReader(
  initialEntry = '/reader',
  nsfwMode: NsfwMode = 'blur',
  container?: HTMLElement,
  itemOrder: ReaderItemOrder = 'desc',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NsfwPreferencesContext value={{ nsfwMode, setNsfwMode: vi.fn() }}>
        <ReaderItemOrderPreferencesContext value={{ itemOrder, setItemOrder: vi.fn() }}>
          <ReaderPage />
        </ReaderItemOrderPreferencesContext>
      </NsfwPreferencesContext>
    </MemoryRouter>,
    container ? { container } : undefined,
  );
}

export function resetReaderPageTest(): void {
  cleanup();
  document.querySelectorAll('main').forEach((main) => main.remove());
  restoreLocalStorage();
  vi.restoreAllMocks();
  vi.resetAllMocks();
}
