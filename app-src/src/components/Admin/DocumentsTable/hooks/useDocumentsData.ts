import { useState, useEffect, useRef, useCallback } from 'react';
import { getDocuments, getOwners } from '@/lib/supabase/admin';
import type { DocumentWithOwner, Owner } from '@/types/admin';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import type { UseDocumentsDataReturn } from '../types';

export function useDocumentsData(): UseDocumentsDataReturn {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithOwner[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const documentsRef = useRef<DocumentWithOwner[]>([]);

  const loadData = useCallback(async (showLoading = true) => {
    console.log('DocumentsTable: loadData called');
    if (!user?.id) {
      if (showLoading) {
        setLoading(false);
      }
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const [docs, ownersList] = await Promise.all([
        getDocuments(user.id),
        getOwners(),
      ]);
      setDocuments(docs);
      documentsRef.current = docs; // Keep ref in sync
      setOwners(ownersList);
      console.log('DocumentsTable: loadData completed, documents loaded:', docs.length);
    } catch (err) {
      console.error('DocumentsTable: loadData error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Listen for document-updated events from inline edits in same browser window
  useEffect(() => {
    const handleDocumentUpdate = () => {
      console.log('DocumentsTable: document-updated event received, refreshing...');
      loadData(false);
    };

    window.addEventListener('document-updated', handleDocumentUpdate);
    
    return () => {
      window.removeEventListener('document-updated', handleDocumentUpdate);
    };
  }, [loadData]);

  // Subscribe to Supabase Realtime for cross-tab/window updates
  useEffect(() => {
    if (!user?.id) return;

    console.log('DocumentsTable: Setting up Realtime subscription for documents table');
    
    const channel = supabase
      .channel('documents_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'documents',
        },
        (payload) => {
          console.log('📡 DocumentsTable: Realtime update received:', payload.eventType, payload);
          loadData(false);
        }
      )
      .subscribe((status) => {
        console.log('DocumentsTable: Realtime subscription status:', status);
      });

    return () => {
      console.log('DocumentsTable: Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadData]);

  const updateDocumentInState = useCallback((docId: string, updates: Partial<DocumentWithOwner>) => {
    setDocuments(prev => {
      const updated = prev.map(doc => 
        doc.id === docId ? { ...doc, ...updates } : doc
      );
      documentsRef.current = updated; // Keep ref in sync
      return updated;
    });
  }, []);

  return {
    documents,
    owners,
    loading,
    error,
    documentsRef,
    loadData,
    updateDocumentInState,
  };
}

