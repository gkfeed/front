import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function usePreviewVisibility(
  ref: RefObject<HTMLElement | null>,
  rootMargin = '400px 0px',
  mode: 'once' | 'continuous' = 'once',
): boolean {
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (mode === 'continuous') {
        setIsVisible(Boolean(entry?.isIntersecting));
        return;
      }
      if (entry?.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin, mode]);

  return isVisible;
}
