import { useState, useEffect, useCallback } from 'react';
import { fetchDocument, DocumentInfo } from '@/services/documentApi';

interface UseDocumentOptions {
  slug: string | string[];
  forceRefresh?: boolean;
}

interface UseDocumentReturn {
  document: DocumentInfo | null;
  documents: DocumentInfo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDocument({ slug, forceRefresh = false }: UseDocumentOptions): UseDocumentReturn {
  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDocument = useCallback(async () => {
    if (!slug) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const slugs = Array.isArray(slug) ? slug : [slug];
      const responses = await Promise.all(
        slugs.map(s => fetchDocument(s, forceRefresh))
      );

      const validDocs = responses.filter((d): d is DocumentInfo => d !== null);
      
      if (validDocs.length > 0) {
        setDocuments(validDocs);
        setDocument(validDocs[0]); // Primary document
      } else {
        setError(`Document not found: ${slug}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load document');
      console.error('Error loading document:', err);
    } finally {
      setLoading(false);
    }
  }, [slug, forceRefresh]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  return {
    document,
    documents,
    loading,
    error,
    refresh: loadDocument,
  };
}

