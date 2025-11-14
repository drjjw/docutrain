/**
 * useQuizStatus - Hook to check quiz generation status for a document
 * Checks if quiz is completed before showing quiz button
 */

import { useEffect, useState } from 'react';
import { getQuizStatus, type QuizStatusResponse } from '@/services/quizApi';
import { debugLog } from '@/utils/debug';

export function useQuizStatus(documentSlug: string | null): {
  status: QuizStatusResponse['status'];
  isLoading: boolean;
  error: string | null;
} {
  const [status, setStatus] = useState<QuizStatusResponse['status']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentSlug) {
      setStatus(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function fetchQuizStatus() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await getQuizStatus(documentSlug);
        if (!cancelled) {
          setStatus(result.status);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          debugLog('[useQuizStatus] Error fetching quiz status:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch quiz status');
          setStatus(null);
          setIsLoading(false);
        }
      }
    }

    fetchQuizStatus();

    return () => {
      cancelled = true;
    };
  }, [documentSlug]);

  return { status, isLoading, error };
}





