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

// Helper function to check if a document is stuck in processing (>5 minutes)
const isDocumentStuck = (doc: UserDocument): boolean => {
  if (doc.status !== 'processing') return false;
  const updatedAt = new Date(doc.updated_at);
  const now = new Date();
  const minutesSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000 / 60;
  return minutesSinceUpdate > 5;
};

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

  const handleRetryProcessing = async (documentId: string, attempt: number = 1) => {
    try {
      setRetryingDocId(documentId);
      
      // Optimistically update the document status to 'processing' in the UI
      setDocuments(prevDocs => 
        prevDocs.map(doc => 
          doc.id === documentId 
            ? { ...doc, status: 'processing' as const, error_message: undefined }
            : doc
        )
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        alert('Not authenticated');
        // Revert optimistic update
        await loadDocuments(false);
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

      if (response.ok) {
        // Success - reload documents to get actual status
        await loadDocuments(false);
        
        // Notify parent of status change
        if (onStatusChange) {
          onStatusChange();
        }
      } else if (response.status === 503 && attempt === 1) {
        // Server busy on first attempt - start automatic retry
        const errorData = await response.json().catch(() => ({}));
        const retryAfter = errorData.retry_after || 30;
        
        console.log(`⚠️  Server busy (503), will retry in ${retryAfter} seconds...`);
        alert(`Server is busy processing other documents. Will automatically retry in ${retryAfter} seconds...`);
        
        // Wait and retry once
        setTimeout(async () => {
          try {
            await handleRetryProcessing(documentId, 2);
          } catch (retryErr) {
            console.error('Retry failed:', retryErr);
          }
        }, retryAfter * 1000);
      } else {
        // Other error or second attempt failed
        const errorData = await response.json().catch(() => ({}));
        // Revert optimistic update on error
        await loadDocuments(false);
        throw new Error(errorData.error || 'Failed to trigger processing');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retry processing');
      // Revert optimistic update on error
      await loadDocuments(false);
      setRetryingDocId(null);
    } finally {
      // Only clear retrying state if this is not the first attempt (which will retry)
      if (attempt !== 1) {
        setRetryingDocId(null);
      }
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
    <div className="space-y-3">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
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
                    {/* Show retry button for error, pending, or stuck processing documents */}
                    {(doc.status === 'error' || doc.status === 'pending' || (doc.status === 'processing' && isDocumentStuck(doc))) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetryProcessing(doc.id)}
                        loading={retryingDocId === doc.id}
                        disabled={deletingDocId !== null || retryingDocId !== null}
                        title={isDocumentStuck(doc) ? 'Force retry (document stuck for >5 minutes)' : 'Retry processing'}
                      >
                        {isDocumentStuck(doc) ? 'Force Retry' : 'Retry'}
                      </Button>
                    )}
                    
                    {/* Show delete button for non-ready documents, with warning for active processing */}
                    {doc.status !== 'ready' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                        loading={deletingDocId === doc.id}
                        disabled={deletingDocId !== null || retryingDocId !== null}
                        title={doc.status === 'processing' && !isDocumentStuck(doc) 
                          ? 'Delete (warning: processing will continue in background)' 
                          : 'Delete this document'}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {activeDocuments.map((doc) => (
          <div key={doc.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="space-y-3">
              {/* Title and Status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 break-words">{doc.title}</div>
                  {doc.error_message && (
                    <div className="text-xs text-red-600 mt-1 break-words">{doc.error_message}</div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {getStatusBadge(doc.status)}
                </div>
              </div>
              
              {/* File Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-gray-500">File Size</div>
                  <div className="text-gray-900 font-medium">{formatFileSize(doc.file_size)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Uploaded</div>
                  <div className="text-gray-900 font-medium">{formatDate(doc.created_at)}</div>
                </div>
              </div>
              
              <div className="text-xs">
                <div className="text-gray-500">Last Updated</div>
                <div className="text-gray-900 font-medium">{formatDate(doc.updated_at)}</div>
              </div>
              
              {/* Actions - Show for non-ready documents */}
              {doc.status !== 'ready' && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                  {/* Show retry button for error, pending, or stuck processing documents */}
                  {(doc.status === 'error' || doc.status === 'pending' || (doc.status === 'processing' && isDocumentStuck(doc))) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetryProcessing(doc.id)}
                      loading={retryingDocId === doc.id}
                      disabled={deletingDocId !== null || retryingDocId !== null}
                      className="flex-1"
                      title={isDocumentStuck(doc) ? 'Force retry (document stuck for >5 minutes)' : 'Retry processing'}
                    >
                      {isDocumentStuck(doc) ? 'Force Retry' : 'Retry'}
                    </Button>
                  )}
                  
                  {/* Show delete button with warning for active processing */}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                    loading={deletingDocId === doc.id}
                    disabled={deletingDocId !== null || retryingDocId !== null}
                    className="flex-1"
                    title={doc.status === 'processing' && !isDocumentStuck(doc) 
                      ? 'Delete (warning: processing will continue in background)' 
                      : 'Delete this document'}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

