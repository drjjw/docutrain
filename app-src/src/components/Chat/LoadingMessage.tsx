/**
 * LoadingMessage - Loading indicator with fun facts rotation
 * Ported from vanilla JS ui-loading.js
 */

import { useState, useEffect, useRef } from 'react';
import { getRandomFact } from '@/utils/facts';

interface LoadingMessageProps {
  owner: string | null;
}

export function LoadingMessage({ owner }: LoadingMessageProps) {
  const initialFact = getRandomFact(owner);
  const [currentFact, setCurrentFact] = useState<string | null>(initialFact);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only start rotation if facts are enabled for this owner
    // But ALWAYS show loading dots even if no facts
    if (getRandomFact(owner) === null) {
      return;
    }

    intervalRef.current = setInterval(() => {
      // Fade out
      setIsFadingOut(true);

      // Change fact and fade in after fade out completes
      setTimeout(() => {
        setCurrentFact(getRandomFact(owner));
        setIsFadingOut(false);
      }, 600); // Match CSS transition duration
    }, 8000); // Change fact every 8 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [owner]);

  // Always show loading dots, even if no fun facts
  return (
    <div className="message assistant" id="loading">
      <div className="message-content loading-container">
        {/* Fun fact display (only for ukidney and maker) */}
        {currentFact && (
          <div
            className={`fun-fact ${isFadingOut ? 'fade-out' : 'fade-in'}`}
            dangerouslySetInnerHTML={{ __html: currentFact }}
          />
        )}

        {/* Loading dots - ALWAYS show */}
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

