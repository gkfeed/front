import { useCallback, useEffect, useState } from 'react';

export type AsyncLoadStatus = 'loading' | 'success' | 'error';

export function useAsyncLoad<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [status, setStatus] = useState<AsyncLoadStatus>('loading');
  const [result, setResult] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    setStatus('loading');
    setResult(undefined);
    setError(null);

    load(controller.signal)
      .then((nextResult) => {
        if (!isActive) return;
        setResult(nextResult);
        setStatus('success');
      })
      .catch((nextError: unknown) => {
        if (isActive && !isAbortError(nextError)) {
          setError(nextError);
          setStatus('error');
        }
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [load, loadAttempt]);

  const retry = useCallback(() => setLoadAttempt((value) => value + 1), []);

  return {
    status,
    result,
    error,
    isLoading: status === 'loading',
    retry,
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
