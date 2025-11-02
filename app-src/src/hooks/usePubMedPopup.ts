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
 * Format author list for display - returns array of author names
 */
function formatAuthors(authors: any[]): string[] {
  if (!authors || authors.length === 0) {
    return ['Authors not available'];
  }

  // Take first 3 authors, then add "et al." if more
  const authorNames = authors.slice(0, 3).map((author) => {
    // Use collective name if available, otherwise format name
    if (author.collectivename) {
      return author.collectivename;
    }
    return `${author.name || author.lastname || ''}${
      author.forename ? ` ${author.forename}` : ''
    }`.trim();
  });

  if (authors.length > 3) {
    authorNames.push('et al.');
  }

  return authorNames;
}

/**
 * Format publication date
 */
function formatPubDate(result: any): string {
  const pubdate = result.pubdate || result.epubdate;
  if (!pubdate) return 'Date not available';

  // Parse different date formats
  try {
    const date = new Date(pubdate);
    if (isNaN(date.getTime())) {
      return pubdate; // Return as-is if parsing fails
    }
    return date.getFullYear().toString();
  } catch {
    return pubdate;
  }
}

/**
 * Extract DOI from article data
 */
function extractDOI(result: any): string | null {
  // Check various places where DOI might be stored
  if (result.doi) return result.doi;
  if (result.elocationid && result.elocationid.startsWith('10.'))
    return result.elocationid;

  // Check articleids array
  if (result.articleids) {
    const doiEntry = result.articleids.find(
      (id: any) => id.idtype === 'doi'
    );
    if (doiEntry) return doiEntry.value;
  }

  return null;
}

/**
 * Fetch PubMed article with retry logic for rate limiting
 * Calls PubMed E-utilities API directly (same as deprecated version)
 */
async function fetchPubMedArticleWithRetry(
  pmid: string,
  maxRetries = 2,
  delay = 1000
): Promise<PubMedArticle> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            `Rate limit exceeded. Please wait before making another request.`
          );
        } else {
          throw new Error(
            `PubMed API error: ${response.status} ${response.statusText}`
          );
        }
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`PubMed API returned error: ${data.error}`);
      }

      // Extract article data
      const result = data.result[pmid];
      if (!result) {
        throw new Error('Article not found in PubMed');
      }

      // Format article data to match expected structure
      const articleData: PubMedArticle = {
        pmid: pmid,
        title: result.title || 'Title not available',
        authors: formatAuthors(result.authors || []),
        journal: result.source || result.fulljournalname || 'Journal not available',
        year: formatPubDate(result),
        abstract: result.abstract || undefined,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };

      return articleData;
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
        await new Promise((resolve) => setTimeout(resolve, delay));
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
