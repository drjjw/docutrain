import { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { Button } from '@/components/UI/Button';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { deleteDocument } from '@/lib/supabase/database';

interface UserDocument {
  id: string;
  title: string;
  file_path: string;
  file_size: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface UserDocumentsTableRef {
  refresh: () => Promise<void>;
  hasActiveDocuments: () => boolean;
}

interface UserDocumentsTableProps {
  onStatusChange?: () => void;
}

export const UserDocumentsTable = forwardRef<UserDocumentsTableRef, UserDocumentsTableProps>((props, ref) => {
  const { onStatusChange } = props;
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingDocId, setRetryingDocId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const documentsRef = useRef<UserDocument[]>([]);

  // Filter to show only documents that are actively processing (not ready)
  const activeDocuments = documents.filter(
    doc => doc.status !== 'ready'
  );

  const loadDocuments = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/user-documents', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load documents');
      }

      const result = await response.json();
      setDocuments(result.documents || []);
      documentsRef.current = result.documents || []; // Keep ref in sync
      setError(null);
      
      // Notify parent of status change
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  // Expose refresh function and hasActiveDocuments via ref
  useImperativeHandle(ref, () => ({
    refresh: () => loadDocuments(false),
    hasActiveDocuments: () => {
      return documentsRef.current.some(doc => doc.status !== 'ready');
    },
  }));

  useEffect(() => {
    loadDocuments(true);
    
    // Set up realtime subscription for document changes
    const channel = supabase
      .channel('user_documents_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_documents',
          filter: user ? `user_id=eq.${user.id}` : undefined,
        },
        (payload) => {
          console.log('📡 Realtime update received:', payload);
          loadDocuments(false).then(() => {
            if (onStatusChange) {
              onStatusChange();
            }
          });
        }
      )
      .subscribe();
    
    // Set up polling for documents in processing state
    // Use ref to check current state without stale closure issues
    const pollInterval = setInterval(() => {
      if (documentsRef.current.some(doc => doc.status === 'processing')) {
        console.log('🔄 Polling: Found processing documents, refreshing...');
        loadDocuments(false).then(() => {
          if (onStatusChange) {
            onStatusChange();
          }
        });
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [user?.id, onStatusChange]); // Include onStatusChange in dependencies

  const handleRetryProcessing = async (documentId: string) => {
    try {
      setRetryingDocId(documentId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch('/api/process-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
        body: JSON.stringify({
          user_document_id: documentId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger processing');
      }

      // Reload documents to show updated status
      await loadDocuments(false);
      
      // Notify parent of status change
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry processing');
    } finally {
      setRetryingDocId(null);
    }
  };

  const handleDelete = async (documentId: string) => {
    const doc = documents.find(d => d.id === documentId);
    if (!doc) return;

    if (!confirm(`Are you sure you want to delete "${doc.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingDocId(documentId);
      await deleteDocument(documentId);
      
      // Reload documents to reflect the deletion
      await loadDocuments(false);
      
      // Notify parent of status change
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete document');
      console.error(err);
    } finally {
      setDeletingDocId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: UserDocument['status']) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full inline-flex items-center gap-1';
    
    switch (status) {
      case 'pending':
        return (
          <span className={`${baseClasses} bg-gray-100 text-gray-700`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending
          </span>
        );
      case 'processing':
        return (
          <span className={`${baseClasses} bg-blue-100 text-blue-700`}>
            <Spinner size="sm" />
            Processing
          </span>
        );
      case 'ready':
        return (
          <span className={`${baseClasses} bg-green-100 text-green-700`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Ready
          </span>
        );
      case 'error':
        return (
          <span className={`${baseClasses} bg-red-100 text-red-700`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Error
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No uploaded documents yet. Upload a PDF to get started.</p>
      </div>
    );
  }

  if (activeDocuments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          All documents have been processed successfully.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              File Size
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Uploaded
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Updated
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {activeDocuments.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{doc.title}</div>
                {doc.error_message && (
                  <div className="text-xs text-red-600 mt-1">{doc.error_message}</div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getStatusBadge(doc.status)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatFileSize(doc.file_size)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(doc.created_at)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(doc.updated_at)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <div className="flex items-center gap-2">
                  {doc.status === 'error' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      loading={deletingDocId === doc.id}
                      disabled={deletingDocId !== null || retryingDocId !== null}
                    >
                      Delete
                    </Button>
                  )}
                  {doc.status === 'error' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetryProcessing(doc.id)}
                      loading={retryingDocId === doc.id}
                      disabled={deletingDocId !== null || retryingDocId !== null}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

