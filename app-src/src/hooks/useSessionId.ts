/**
 * useSessionId - Hook for managing chat session ID
 * Generates a unique session ID per browser session (using sessionStorage)
 * This ensures each chat session is independent and limits reset when the tab is closed
 */

import { useState, useEffect } from 'react';

export function useSessionId() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  useEffect(() => {
    const generateSessionId = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
    
    // Use sessionStorage instead of localStorage
    // This persists only for the current browser tab session
    // When the tab closes, a new session ID will be generated on next visit
    const storedSessionId = sessionStorage.getItem('chat-session-id');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = generateSessionId();
      sessionStorage.setItem('chat-session-id', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);
  
  return { sessionId };
}




