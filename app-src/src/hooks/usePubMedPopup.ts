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

  // Clean and validate PubMed ID
  const cleanPmid = String(pmid).trim();
  if (!cleanPmid || !/^\d+$/.test(cleanPmid)) {
    throw new Error(`Invalid PubMed ID: ${pmid}`);
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Use clean PMID in URL
      // Add tool and email parameters as recommended by PubMed API documentation
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${cleanPmid}&retmode=json&tool=DocuTrain&email=support@doctrain.ai`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        // Add mode to handle CORS
        mode: 'cors',
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            `Rate limit exceeded. Please wait before making another request.`
          );
        } else if (response.status === 0 || response.type === 'opaque') {
          // CORS error
          throw new Error(
            `CORS error: Unable to fetch from PubMed API. This may be a browser security restriction.`
          );
        } else {
          throw new Error(
            `PubMed API error: ${response.status} ${response.statusText}`
          );
        }
      }

      let data;
      try {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.error('[PubMed] Failed to parse API response:', parseError);
          console.error('[PubMed] Response text:', text.substring(0, 500));
          throw new Error('Invalid JSON response from PubMed API');
        }
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.message.includes('Invalid JSON')) {
          throw fetchError;
        }
        console.error('[PubMed] Failed to read response:', fetchError);
        throw new Error('Failed to read response from PubMed API');
      }

      if (data.error) {
        throw new Error(`PubMed API returned error: ${data.error}`);
      }

      // Check if result object exists
      if (!data.result) {
        console.error('[PubMed] API response missing result:', data);
        throw new Error('Invalid response from PubMed API');
      }

      // Extract article data - try both clean PMID and original PMID
      const result = data.result[cleanPmid] || data.result[pmid];
      
      if (!result) {
        // Log available keys for debugging
        const availableIds = Object.keys(data.result || {}).filter(key => key !== 'uids');
        console.error('[PubMed] Article not found. Available IDs:', availableIds);
        console.error('[PubMed] Requested PMID:', cleanPmid);
        console.error('[PubMed] Response structure:', {
          hasResult: !!data.result,
          resultKeys: Object.keys(data.result || {}),
          uids: data.result?.uids
        });
        
        // Check if there's a uids array that might contain the ID
        if (data.result?.uids && Array.isArray(data.result.uids)) {
          const firstUid = data.result.uids[0];
          if (firstUid && data.result[firstUid]) {
            // Use the first UID from the array
            const fallbackResult = data.result[firstUid];
            if (fallbackResult) {
              // Format article data
              const articleData: PubMedArticle = {
                pmid: cleanPmid,
                title: fallbackResult.title || 'Title not available',
                authors: formatAuthors(fallbackResult.authors || []),
                journal: fallbackResult.source || fallbackResult.fulljournalname || 'Journal not available',
                year: formatPubDate(fallbackResult),
                abstract: fallbackResult.abstract || undefined,
                url: `https://pubmed.ncbi.nlm.nih.gov/${cleanPmid}/`,
              };
              return articleData;
            }
          }
        }
        
        throw new Error(`Article not found in PubMed (PMID: ${cleanPmid})`);
      }

      // Format article data to match expected structure
      const articleData: PubMedArticle = {
        pmid: cleanPmid,
        title: result.title || 'Title not available',
        authors: formatAuthors(result.authors || []),
        journal: result.source || result.fulljournalname || 'Journal not available',
        year: formatPubDate(result),
        abstract: result.abstract || undefined,
        url: `https://pubmed.ncbi.nlm.nih.gov/${cleanPmid}/`,
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
