import { useState, useCallback, useEffect, useRef } from 'react';

export function useAutoScroll() {
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const shouldAutoScroll = useCallback(() => {
    return !userHasScrolled;
  }, [userHasScrolled]);

  const resetAutoScroll = useCallback(() => {
    setUserHasScrolled(false);
    console.log('🔄 Auto-scroll resumed for new response');
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    shouldAutoScroll,
    resetAutoScroll,
    setUserHasScrolled
  };
}

