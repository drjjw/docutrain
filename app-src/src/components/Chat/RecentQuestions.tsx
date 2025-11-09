/**
 * RecentQuestions - Displays a modern gallery of recent questions for a document
 * Updates in realtime when new questions are asked
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getAuthHeaders } from '@/lib/api/authService';
import { debugLog } from '@/utils/debug';

interface RecentQuestion {
  id: string;
  question: string;
  created_at: string;
  country?: string | null;
}

interface RecentQuestionsProps {
  documentSlug: string;
  documentId: string;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  onQuestionClick?: (question: string) => void;
  showCountryFlags?: boolean; // Whether to show country flags
}

// Hook to detect mobile screen size
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    // Initialize based on current window width (SSR-safe)
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/**
 * Get flag CSS class for a country code
 * Uses flag-icons library (https://github.com/lipis/flag-icons)
 * @param countryCode - Two-letter country code (e.g., 'US', 'CA', 'GB')
 * @returns CSS class string or null
 */
function getCountryFlagClass(countryCode: string | null | undefined): string | null {
  if (!countryCode || countryCode.length !== 2) {
    return null;
  }
  
  // flag-icons uses format: fi fi-xx where xx is lowercase ISO 3166-1-alpha-2 code
  // Regular flags (4:3 aspect ratio) - more natural looking
  const normalizedCode = countryCode.toLowerCase();
  return `fi fi-${normalizedCode}`;
}

export function RecentQuestions({ 
  documentSlug, 
  documentId,
  inputRef,
  onQuestionClick,
  showCountryFlags = false
}: RecentQuestionsProps) {
  const [questions, setQuestions] = useState<RecentQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  // Initialize collapsed state - start collapsed on mobile, expanded on desktop
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768; // Start collapsed on mobile
    }
    return false; // Default to expanded on server/desktop
  });

  debugLog('[RecentQuestions] Component rendered:', { documentSlug, documentId });

  // Fetch recent questions
  const fetchQuestions = useCallback(async () => {
    if (!documentId) return;
    
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/documents/${documentId}/recent-questions?limit=10`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.status}`);
      }

      const data = await response.json();
      debugLog('[RecentQuestions] Fetched questions:', data.questions?.map(q => ({ 
        id: q.id, 
        question: q.question?.substring(0, 30), 
        country: q.country 
      })));
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('[RecentQuestions] Error fetching questions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  // Initial fetch
  useEffect(() => {
    if (documentId) {
      fetchQuestions();
    }
  }, [documentId, fetchQuestions]);

  // Set up realtime subscription for new questions
  useEffect(() => {
    if (!documentId) return;

    debugLog(`[RecentQuestions] 🔌 Setting up realtime subscription for document ${documentId}`);

    const channel = supabase
      .channel(`recent_questions_${documentId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_conversations',
          // Filter: document_ids JSONB array contains documentId AND banned is false
          // Note: Supabase realtime doesn't support complex JSONB filters directly
          // We'll filter in the callback instead
        },
        (payload) => {
          debugLog(`[RecentQuestions] 📡 New conversation received:`, payload);
          
          // Check if this conversation is for our document and not banned
          const newDocIds = payload.new.document_ids;
          const isForThisDocument = 
            (Array.isArray(newDocIds) && newDocIds.includes(documentId)) ||
            payload.new.document_name === documentSlug; // Legacy support
          
          if (isForThisDocument && payload.new.banned !== true && payload.new.question) {
            const newQuestion: RecentQuestion = {
              id: payload.new.id,
              question: payload.new.question,
              created_at: payload.new.created_at,
              country: payload.new.country || null,
            };
            
            setQuestions((prev) => {
              // Check if question already exists (avoid duplicates)
              if (prev.some(q => q.id === newQuestion.id)) {
                return prev;
              }
              // Add to beginning and limit to 10
              return [newQuestion, ...prev].slice(0, 10);
            });
          }
        }
      )
      .subscribe((status) => {
        debugLog(`[RecentQuestions] Realtime subscription status:`, status);
      });

    return () => {
      debugLog(`[RecentQuestions] Cleaning up realtime subscription`);
      supabase.removeChannel(channel);
    };
  }, [documentId, documentSlug]);

  const handleQuestionClick = (question: string) => {
    if (onQuestionClick) {
      onQuestionClick(question);
    } else if (inputRef.current) {
      // Set the input value
      if ('value' in inputRef.current) {
        inputRef.current.value = question;
        // Trigger input event for React state updates
        const event = new Event('input', { bubbles: true });
        inputRef.current.dispatchEvent(event);
      }
      // Focus the input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  if (loading && questions.length === 0) {
    return (
      <div className="recent-questions-container">
        <div className="recent-questions-header">
          <h3 className="recent-questions-title">Recent Questions</h3>
        </div>
        <div className="recent-questions-loading">
          <div className="animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="recent-question-skeleton">
                <div className="recent-question-skeleton-icon"></div>
                <div className="recent-question-skeleton-text"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return null; // Fail silently - don't show error state
  }

  if (questions.length === 0) {
    return null; // Don't show empty state
  }

  // Only show if there are at least 2 questions
  if (questions.length < 2) {
    return null;
  }

  // Determine grid columns based on question count
  const getGridColumns = () => {
    if (questions.length === 2) return 'repeat(2, 1fr)';
    if (questions.length === 3) return 'repeat(3, 1fr)';
    // For 4+, use auto-fit with minmax
    return 'repeat(auto-fit, minmax(280px, 1fr))';
  };

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div 
      className={`recent-questions-container ${isCollapsed ? 'collapsed' : ''}`}
    >
      <div className="recent-questions-header">
        <h3 className="recent-questions-title">Recent Questions</h3>
        <div className="recent-questions-header-controls">
          {loading && questions.length > 0 && (
            <div className="recent-questions-loading-indicator">
              <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="recent-questions-toggle"
            type="button"
            aria-label={isCollapsed ? 'Expand recent questions' : 'Collapse recent questions'}
            aria-expanded={!isCollapsed}
          >
            <svg
              className={`recent-questions-toggle-icon ${isCollapsed ? '' : 'expanded'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      {!isCollapsed && (
        <div className="recent-questions-grid" style={{ gridTemplateColumns: getGridColumns() }}>
          {questions.map((q) => (
            <button
              key={q.id}
              onClick={() => handleQuestionClick(q.question)}
              className="recent-question-card"
              type="button"
            >
              <div className="recent-question-content">
                <svg 
                  className="recent-question-icon" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
                  />
                </svg>
                <span className="recent-question-text">{q.question}</span>
                {showCountryFlags && q.country && getCountryFlagClass(q.country) && (
                  <span 
                    className={`recent-question-country ${getCountryFlagClass(q.country)}`}
                    title={q.country}
                  />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

