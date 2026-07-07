import { useCallback, useEffect, useState } from 'react';
import type { DependencyList } from 'react';

export function useAsyncLoad<T>(load: () => Promise<T>, dependencies: DependencyList) {
  const [result, setResult] = useState<T>();
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;
    setResult(undefined);
    setIsLoading(true);

    load()
      .then((nextResult) => {
        if (!isActive) return;
        setResult(nextResult);
        setIsLoading(false);
      })
      .catch(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [loadAttempt, ...dependencies]);

  const retry = useCallback(() => setLoadAttempt((value) => value + 1), []);

  return {
    result,
    isLoading,
    retry,
  };
}
