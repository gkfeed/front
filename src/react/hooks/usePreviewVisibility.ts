import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function usePreviewVisibility(ref: RefObject<HTMLElement | null>): boolean {
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '400px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return isVisible;
}
