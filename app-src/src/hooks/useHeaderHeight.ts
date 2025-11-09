/**
 * useHeaderHeight - Hook to dynamically measure header height
 * Uses ResizeObserver to detect when header height changes and updates padding accordingly
 */

import { useEffect, useState, RefObject } from 'react';

export function useHeaderHeight(headerRef: RefObject<HTMLElement | null>): number {
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    // Initial measurement with a small delay to ensure header is fully rendered
    const updateHeight = () => {
      const height = header.offsetHeight;
      if (height > 0) {
        setHeaderHeight(height);
      }
    };

    // Measure immediately and after a short delay to catch any layout changes
    updateHeight();
    const timeoutId = setTimeout(updateHeight, 100);
    const rafId = requestAnimationFrame(() => {
      updateHeight();
    });

    // Use ResizeObserver to detect height changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.target.getBoundingClientRect().height;
        if (height > 0) {
          setHeaderHeight(height);
        }
      }
    });

    resizeObserver.observe(header);

    // Also listen for window resize (in case layout changes)
    window.addEventListener('resize', updateHeight);

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [headerRef]);

  return headerHeight;
}

