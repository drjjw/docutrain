import { useState, useEffect } from 'react';
import { getUserDocuments, subscribeToDocuments } from '@/lib/supabase/database';
import type { UserDocument } from '@/types/document';
import { useAuth } from './useAuth';

export function useDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const docs = await getUserDocuments(user.id);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    // Subscribe to real-time changes
    if (user) {
      const unsubscribe = subscribeToDocuments(user.id, () => {
        // Refetch when changes occur
        fetchDocuments();
      });

      return () => {
        unsubscribe();
      };
    }
  }, [user?.id]);

  return {
    documents,
    loading,
    error,
    refetch: fetchDocuments,
  };
}

