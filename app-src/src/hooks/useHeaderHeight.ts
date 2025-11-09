/**
 * useHeaderHeight - Hook to dynamically measure header height
 * Uses ResizeObserver to detect when header height changes and updates padding accordingly
 */

import { useEffect, useState, RefObject } from 'react';

export function useHeaderHeight(
  headerRef: RefObject<HTMLElement | null>,
  triggerDependency?: unknown
): number {
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

  // Trigger re-measurement when dependency changes (e.g., subtitle presence)
  useEffect(() => {
    if (triggerDependency !== undefined) {
      const header = headerRef.current;
      if (!header) {
        return;
      }
      
      // Use multiple timing strategies to ensure we catch the height change
      // This handles cases where content is added but ResizeObserver hasn't fired yet
      const updateHeight = () => {
        const height = header.offsetHeight;
        if (height > 0) {
          setHeaderHeight(height);
        }
      };
      
      // Immediate measurement
      updateHeight();
      
      // Delayed measurements to catch async layout changes
      const timeout1 = setTimeout(updateHeight, 50);
      const timeout2 = setTimeout(updateHeight, 150);
      const rafId = requestAnimationFrame(() => {
        requestAnimationFrame(updateHeight); // Double RAF for layout completion
      });
      
      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
        cancelAnimationFrame(rafId);
      };
    }
  }, [headerRef, triggerDependency]);

  return headerHeight;
}

