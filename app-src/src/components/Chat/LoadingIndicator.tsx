import React, { useEffect, useState } from 'react';
import { getRandomFact } from '@/utils/facts';

interface LoadingIndicatorProps {
  owner?: string | null;
}

export function LoadingIndicator({ owner = null }: LoadingIndicatorProps) {
  const [currentFact, setCurrentFact] = useState<string | null>(() => getRandomFact(owner));
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (!currentFact) return; // No rotation for owners without facts

    const interval = setInterval(() => {
      setIsFading(true);
      
      setTimeout(() => {
        const newFact = getRandomFact(owner);
        setCurrentFact(newFact);
        setIsFading(false);
      }, 600);
    }, 8000); // Change fact every 8 seconds

    return () => clearInterval(interval);
  }, [owner, currentFact]);

  return (
    <div className="message assistant" id="loading">
      <div className="message-content loading-container">
        {currentFact && (
          <div className={`fun-fact ${isFading ? 'fade-out' : 'fade-in'}`} 
               dangerouslySetInnerHTML={{ __html: currentFact }} />
        )}
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}

