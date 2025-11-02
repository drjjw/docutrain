/**
 * usePubMedPopup - Hook for managing PubMed popup display and article fetching
 * Ported from vanilla JS pubmed-popup.js
 */

import { useState, useCallback } from 'react';

interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year?: string;
  abstract?: string;
  url: string;
}

interface UsePubMedPopupReturn {
  article: PubMedArticle | null;
  loading: boolean;
  error: string | null;
  isOpen: boolean;
  openPopup: (pmid: string) => Promise<void>;
  closePopup: () => void;
}

/**
 * Fetch PubMed article with retry logic for rate limiting
 */
async function fetchPubMedArticleWithRetry(
  pmid: string,
  maxRetries = 2,
  delay = 1000
): Promise<PubMedArticle> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`/api/pubmed/${pmid}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }

      // If it's a rate limit error (429) or network error, wait and retry
      if (
        lastError.message.includes('429') ||
        lastError.message.includes('rate limit') ||
        lastError.message.includes('fetch')
      ) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        // For other errors (like article not found), don't retry
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Failed to fetch PubMed article');
}

export function usePubMedPopup(): UsePubMedPopupReturn {
  const [article, setArticle] = useState<PubMedArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openPopup = useCallback(async (pmid: string) => {
    setLoading(true);
    setError(null);
    setIsOpen(true);

    try {
      const articleData = await fetchPubMedArticleWithRetry(pmid);
      setArticle(articleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch PubMed article');
      setArticle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const closePopup = useCallback(() => {
    setIsOpen(false);
    setArticle(null);
    setError(null);
  }, []);

  return {
    article,
    loading,
    error,
    isOpen,
    openPopup,
    closePopup,
  };
}
