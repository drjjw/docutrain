/**
 * useDocumentConfig - Hook for fetching document configuration
 * Fetches document metadata including title, subtitle, PubMed info, owner
 */

import { useState, useEffect } from 'react';

export interface Keyword {
  term: string;
  weight: number;
}

export interface Download {
  url: string;
  title: string;
}

interface DocumentConfig {
  slug: string;
  title: string;
  subtitle?: string;
  welcomeMessage?: string;
  introMessage?: string;
  cover?: string;
  owner?: string;
  category?: string;
  year?: string;
  showDocumentSelector?: boolean;
  keywords?: Keyword[];
  downloads?: Download[];
  ownerInfo?: {
    slug: string;
    name: string;
    logo_url?: string;
  };
  metadata?: {
    pubmed_pmid?: string;
    [key: string]: any;
  };
}

export function useDocumentConfig(documentSlug: string | null) {
  const [config, setConfig] = useState<DocumentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentSlug) {
      setConfig(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadConfig(forceRefresh = false) {
      try {
        setLoading(true);
        setError(null);

        // Add forceRefresh parameter to bypass cache
        const url = `/api/documents?doc=${encodeURIComponent(documentSlug)}${forceRefresh ? '&forceRefresh=true' : ''}`;
        
        // Fetch document config from API
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const documents = data.documents || [];
        
        // Find the document with matching slug
        const doc = documents.find((d: DocumentConfig) => d.slug === documentSlug);

        if (!cancelled) {
          if (doc) {
            setConfig(doc);
          } else {
            setConfig(null);
            setError('Document not found');
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load document config');
          setConfig(null);
          setLoading(false);
        }
      }
    }

    loadConfig();

    // Listen for document update events
    const handleDocumentUpdate = () => {
      if (!cancelled) {
        loadConfig(true);
      }
    };

    window.addEventListener('document-updated', handleDocumentUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener('document-updated', handleDocumentUpdate);
    };
  }, [documentSlug]);

  return { config, loading, error };
}
