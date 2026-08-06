import { useCallback, useState } from 'react';

import { useAsyncResource } from './useAsyncResource';
import { useFeatureUseCases } from '../state/useFeatureUseCases';

export function useArticleReader(url: string) {
  const [isOpen, setIsOpen] = useState(false);
  const { preview } = useFeatureUseCases();
  const load = useCallback(
    (signal: AbortSignal) => preview.getArticle(url, signal),
    [preview, url],
  );
  const resource = useAsyncResource(load, { enabled: isOpen, key: url, timeoutMs: 20_000 });

  return {
    isOpen,
    open: useCallback(() => setIsOpen(true), []),
    close: useCallback(() => setIsOpen(false), []),
    ...resource,
  };
}
