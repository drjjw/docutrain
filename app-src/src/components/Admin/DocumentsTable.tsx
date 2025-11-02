import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/UI/Button';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { Toggle } from '@/components/UI/Toggle';
import { DocumentEditorModal } from './DocumentEditorModal';
import { getDocuments, deleteDocument, getOwners, updateDocument } from '@/lib/supabase/admin';
import type { DocumentWithOwner, Owner } from '@/types/admin';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';

interface DocumentsTableProps {
  isSuperAdmin?: boolean;
}

export interface DocumentsTableRef {
  refresh: () => Promise<void>;
}

export const DocumentsTable = forwardRef<DocumentsTableRef, DocumentsTableProps>((props, ref) => {
  const { isSuperAdmin = false } = props;
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithOwner[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentWithOwner[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<DocumentWithOwner | null>(null);
  const [editorModalDoc, setEditorModalDoc] = useState<DocumentWithOwner | null>(null);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  const [updatingDocIds, setUpdatingDocIds] = useState<Set<string>>(new Set());

  // Debug editorModalDoc changes
  React.useEffect(() => {
    console.log('DocumentsTable: editorModalDoc changed:', editorModalDoc?.id || 'null');
  }, [editorModalDoc]);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'passcode' | 'registered' | 'owner_restricted' | 'owner_admin_only'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Filter documents based on search query and filters
  useEffect(() => {
    let filtered = documents;

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc => (
        doc.title?.toLowerCase().includes(query) ||
        doc.subtitle?.toLowerCase().includes(query) ||
        doc.slug?.toLowerCase().includes(query) ||
        doc.category?.toLowerCase().includes(query) ||
        doc.owners?.name?.toLowerCase().includes(query)
      ));
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => {
        const isActive = doc.active ?? false;
        return statusFilter === 'active' ? isActive : !isActive;
      });
    }

    // Apply visibility filter
    if (visibilityFilter !== 'all') {
      filtered = filtered.filter(doc => {
        const accessLevel = doc.access_level || 'public';
        return accessLevel === visibilityFilter;
      });
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(doc => doc.category === categoryFilter);
    }

    // Apply owner filter (super admin only)
    if (isSuperAdmin && ownerFilter !== 'all') {
      filtered = filtered.filter(doc => doc.owner_id === ownerFilter);
    }

    setFilteredDocuments(filtered);
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [documents, searchQuery, statusFilter, visibilityFilter, categoryFilter, ownerFilter, isSuperAdmin]);

  // Calculate paginated documents
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Reset page when items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const loadData = React.useCallback(async (showLoading = true) => {
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

  // Expose refresh method via ref
  useImperativeHandle(ref, () => ({
    refresh: () => loadData(false),
  }));

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

  const handleDelete = async (doc: DocumentWithOwner) => {
    try {
      setSaving(true);
      await deleteDocument(doc.id);
      setDocuments(docs => docs.filter(d => d.id !== doc.id));
      setDeleteConfirmDoc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async (doc: DocumentWithOwner) => {
    const link = `${window.location.origin}/app/chat?doc=${doc.slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedDocId(doc.id);
      setTimeout(() => setCopiedDocId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedDocId(doc.id);
        setTimeout(() => setCopiedDocId(null), 2000);
      } catch (fallbackErr) {
        setError('Failed to copy link to clipboard');
      }
      document.body.removeChild(textArea);
    }
  };

  const handleToggleActive = async (doc: DocumentWithOwner, newActive: boolean) => {
    // Optimistically update the UI
    setUpdatingDocIds(prev => new Set(prev).add(doc.id));
    
    try {
      // Include slug in updates as required by the API endpoint
      await updateDocument(doc.id, { active: newActive, slug: doc.slug });
      
      // Dispatch event to trigger refresh in other tabs/components
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('document-updated', {
          detail: { documentSlug: doc.slug }
        }));
      }, 200);
      
      // Update the document in state
      setDocuments(prevDocs => 
        prevDocs.map(d => 
          d.id === doc.id ? { ...d, active: newActive } : d
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document status');
      // Revert the optimistic update on error - the document state will naturally revert
      // since we're not updating it on error
    } finally {
      setUpdatingDocIds(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };




  const renderStatusToggle = (doc: DocumentWithOwner) => {
    const isUpdating = updatingDocIds.has(doc.id);
    const isActive = doc.active ?? false;
    
    return (
      <div className="flex items-center gap-2">
        <Toggle
          checked={isActive}
          onChange={(checked) => handleToggleActive(doc, checked)}
          disabled={isUpdating}
          size="sm"
        />
        <span className={`inline-flex items-center justify-center w-32 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/50 shadow-sm text-center`}>
          <span className={`text-xs font-semibold ${isActive ? 'text-green-700' : 'text-gray-600'}`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </span>
      </div>
    );
  };

  const renderVisibilityBadge = (accessLevel: string = 'public') => {
    switch (accessLevel) {
      case 'public':
        return (
          <span className="inline-flex items-center justify-center w-32 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200/50 shadow-sm text-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 002 2h2.945M11 3.055V5a2 2 0 002 2h1M13 13v2.945M20.945 13H19a2 2 0 00-2-2v-1a2 2 0 00-2-2 2 2 0 00-2-2H9.055M11 20.945V19a2 2 0 002-2v-1a2 2 0 002 2h2.945M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Public
          </span>
        );
      case 'passcode':
        return (
          <span className="inline-flex items-center justify-center w-32 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#65ccff]/30 text-[#3399ff] border border-[#65ccff]/50 shadow-sm text-center">
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Passcode
          </span>
        );
      case 'registered':
        return (
          <span className="inline-flex items-center justify-center w-32 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-800 border border-green-200/50 shadow-sm text-center">
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Registered
          </span>
        );
      case 'owner_restricted':
        return (
          <span className="inline-flex items-center justify-center w-32 px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200/50 shadow-sm text-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Owner
          </span>
        );
      case 'owner_admin_only':
        return (
          <span className="inline-flex items-center justify-center w-32 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-800 border border-red-200/50 shadow-sm text-center">
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Owner Admins Only
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center justify-center w-32 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/50 shadow-sm text-center">
            Unknown
          </span>
        );
    }
  };

  const hasDownloadAvailable = (doc: DocumentWithOwner): boolean => {
    // Only show download button for user-uploaded documents
    // These are the only ones actually stored in Supabase storage
    return doc.pdf_subdirectory === 'user-uploads' && !!doc.pdf_filename;
  };

  const handleDownload = async (doc: DocumentWithOwner) => {
    try {
      // Always fetch the original training PDF via the backend API
      const response = await fetch(`/api/document-download-url/${doc.id}`);
      const data = await response.json();
      
      if (data.success && data.url) {
        window.open(data.url, '_blank');
      } else {
        setError(data.error || 'Failed to generate download URL');
      }
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download PDF');
    }
  };

  const renderActionButtons = (doc: DocumentWithOwner, isMobile: boolean = false) => {
    const showDownload = hasDownloadAvailable(doc);
    
    if (isMobile) {
      // Mobile: horizontal layout with icons and text
      return (
        <div className="grid grid-cols-5 gap-1">
          {/* View Button */}
          <button
            onClick={() => window.open(`/app/chat?doc=${doc.slug}`, '_blank')}
            className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View document"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-xs text-gray-500">View</span>
          </button>

          {/* Download PDF Button - Only show if downloads exist in database */}
          {showDownload && (
            <button
              onClick={() => handleDownload(doc)}
              className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title={doc.downloads!.length > 1 ? `${doc.downloads!.length} downloads available` : 'Download PDF'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs text-gray-500">
                {doc.downloads!.length > 1 ? `PDF (${doc.downloads!.length})` : 'PDF'}
              </span>
            </button>
          )}

          {/* Copy Link Button */}
          <button
            onClick={() => handleCopyLink(doc)}
            className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="Copy link"
          >
            {copiedDocId === doc.id ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
            <span className="text-xs text-gray-500">Copy</span>
          </button>

          {/* Edit All Button */}
          <button
            onClick={() => setEditorModalDoc(doc)}
            className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-[#3399ff] hover:bg-[#65ccff]/20 rounded-lg transition-colors"
            title="Edit all fields"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-xs text-gray-500">Config</span>
          </button>

          {/* Delete Button */}
          <button
            onClick={() => setDeleteConfirmDoc(doc)}
            className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete document"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-xs text-gray-500">Delete</span>
          </button>
        </div>
      );
    }
    
    // Desktop: original layout
    return (
      <div className="flex items-center gap-2">
        {/* View Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => window.open(`/app/chat?doc=${doc.slug}`, '_blank')}
            className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50/80 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
            title="View document"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <span className="text-xs text-gray-500 font-medium">View</span>
        </div>

        {/* Download PDF Button - Only show if downloads exist in database */}
        {showDownload && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => handleDownload(doc)}
              className="p-2.5 text-gray-400 hover:text-green-600 hover:bg-green-50/80 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
              title={doc.downloads!.length > 1 ? `${doc.downloads!.length} downloads available` : 'Download PDF'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
            <span className="text-xs text-gray-500 font-medium">
              {doc.downloads!.length > 1 ? `PDF (${doc.downloads!.length})` : 'PDF'}
            </span>
          </div>
        )}

        {/* Copy Link Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => handleCopyLink(doc)}
            className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50/80 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
            title="Copy link"
          >
            {copiedDocId === doc.id ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <span className="text-xs text-gray-500 font-medium">Copy</span>
        </div>

        {/* Edit All Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setEditorModalDoc(doc)}
            className="p-2.5 text-gray-400 hover:text-[#3399ff] hover:bg-[#65ccff]/20 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
            title="Edit all fields"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <span className="text-xs text-gray-500 font-medium">Config</span>
        </div>

        {/* Delete Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setDeleteConfirmDoc(doc)}
            className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50/80 rounded-xl transition-all duration-200 hover:shadow-md hover:scale-110"
            title="Delete document"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <span className="text-xs text-gray-500 font-medium">Delete</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Bar - Full width on mobile */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search documents ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl leading-5 bg-white/80 backdrop-blur-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 sm:text-sm"
          />
        </div>

        {/* Filters Grid - Stack on mobile, row on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Visibility Filter */}
          <div className="relative">
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as 'all' | 'public' | 'passcode' | 'registered' | 'owner_restricted' | 'owner_admin_only')}
              className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
            >
              <option value="all">All Access Levels</option>
              <option value="public">Public</option>
              <option value="passcode">Passcode</option>
              <option value="registered">Registered</option>
              <option value="owner_restricted">Owner</option>
              <option value="owner_admin_only">Owner Admins Only</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
            >
              <option value="all">All Categories</option>
              <option value="Guidelines">Guidelines</option>
              <option value="Maker">Maker</option>
              <option value="Manuals">Manuals</option>
              <option value="Presentation">Presentation</option>
              <option value="Recipes">Recipes</option>
              <option value="Reviews">Reviews</option>
              <option value="Slides">Slides</option>
              <option value="Training">Training</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Owner Filter (Super Admin only) */}
          {isSuperAdmin && (
            <div className="relative">
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
              >
                <option value="all">All Owners</option>
                {owners.map(owner => (
                  <option key={owner.id} value={owner.id}>{owner.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Clear Filters */}
        {(searchQuery || statusFilter !== 'all' || visibilityFilter !== 'all' || categoryFilter !== 'all' || ownerFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setVisibilityFilter('all');
              setCategoryFilter('all');
              setOwnerFilter('all');
              setCurrentPage(1);
            }}
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear All Filters
          </button>
        )}
      </div>

      {/* Table Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
            Documents ({paginatedDocuments.length} of {filteredDocuments.length}{filteredDocuments.length !== documents.length ? ` total` : ''})
          </h3>
          <div className="flex gap-2">
            <span className="inline-flex items-center justify-center w-32 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-800 border border-green-200/50 shadow-sm text-center">
              {filteredDocuments.filter(doc => doc.active ?? false).length} Active
            </span>
            <span className="inline-flex items-center justify-center w-32 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200/50 shadow-sm text-center">
              {filteredDocuments.filter(doc => (doc.access_level || 'public') === 'public').length} Public
            </span>
          </div>
        </div>
        {/* Items per page selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Show:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 font-medium text-gray-700"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-600 hidden sm:inline font-medium">per page</span>
        </div>
      </div>

      {/* Documents Grid/List */}
      {paginatedDocuments.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-100 flex items-center justify-center shadow-inner">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {searchQuery ? 'No documents found' : 'No documents found'}
          </h3>
          <p className="text-gray-600 font-medium">
            {searchQuery ? `No documents match "${searchQuery}"` : 'Get started by uploading your first document above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Table Header Row */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-4 bg-gray-50 rounded-xl border border-gray-200/60 shadow-sm">
            <div className="col-span-3 text-xs font-bold text-gray-600 uppercase tracking-wider">Document</div>
            <div className="col-span-2 text-xs font-bold text-gray-600 uppercase tracking-wider">Status</div>
            <div className="col-span-2 text-xs font-bold text-gray-600 uppercase tracking-wider">Visibility</div>
            <div className="col-span-2 text-xs font-bold text-gray-600 uppercase tracking-wider">Category</div>
            {isSuperAdmin && (
              <div className="col-span-1 text-xs font-bold text-gray-600 uppercase tracking-wider">Owner</div>
            )}
            <div className="col-span-2 text-xs font-bold text-gray-600 uppercase tracking-wider flex justify-center">Actions</div>
          </div>

          {/* Document Rows */}
          {paginatedDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:shadow-lg hover:border-gray-300 transition-all duration-300 hover:-translate-y-0.5"
            >
              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-base">
                          {doc.title || 'Untitled Document'}
                        </div>
                        <div className="text-sm text-gray-500 truncate font-medium mt-0.5">
                          {doc.subtitle || doc.slug}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <div className="flex items-center gap-2">
                        {renderStatusToggle(doc)}
                      </div>
                      {renderVisibilityBadge(doc.access_level || 'public')}
                      {doc.category && (
                        <span className="inline-flex items-center justify-center w-32 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/50 shadow-sm text-center">
                          {doc.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {doc.year && (
                    <div className="text-xs text-gray-500">
                      Year: {doc.year}
                    </div>
                  )}
                  {renderActionButtons(doc, true)}
                </div>
              </div>

              {/* Desktop Grid View */}
              <div className="hidden lg:grid grid-cols-12 gap-4 p-5">
                {/* Document Info */}
                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-base">
                        {doc.title || 'Untitled Document'}
                      </div>
                      <div className="text-sm text-gray-600 truncate font-medium mt-0.5">
                        {doc.subtitle || doc.slug}
                      </div>
                      {doc.year && (
                        <div className="text-xs text-gray-400 font-medium mt-1">
                          {doc.year}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  {renderStatusToggle(doc)}
                </div>

                {/* Visibility */}
                <div className="col-span-2">
                  {renderVisibilityBadge(doc.access_level || 'public')}
                </div>

                {/* Category */}
                <div className="col-span-2 flex items-center">
                  {doc.category ? (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200/50 shadow-sm">
                      {doc.category}
                    </span>
                  ) : null}
                </div>

                {/* Owner (Super Admin only) */}
                {isSuperAdmin && (
                  <div className="col-span-1 flex items-center justify-center min-w-0 w-full">
                    {doc.owners?.name ? (
                      <div className="relative group w-full min-w-0">
                        <span 
                          className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-sm overflow-hidden text-ellipsis whitespace-nowrap w-full text-center"
                        >
                          {doc.owners.name}
                        </span>
                        {/* Tooltip */}
                        <div className="absolute left-0 bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 whitespace-nowrap max-w-xs">
                          {doc.owners.name}
                          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Actions */}
                <div className="col-span-2 flex justify-center">
                  {renderActionButtons(doc)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {filteredDocuments.length > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-gray-200/60 bg-gray-50 px-5 py-4 sm:px-6 rounded-b-xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-700">
            <span className="font-bold">Page {currentPage} of {totalPages}</span>
            <span className="text-gray-600 text-xs sm:text-sm font-medium">
              ({startIndex + 1}-{Math.min(endIndex, filteredDocuments.length)} of {filteredDocuments.length} documents)
            </span>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-md hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Page Numbers - Hide on very small screens */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                      currentPage === pageNum
                        ? 'text-white bg-[#3399ff] border border-[#3399ff] shadow-md shadow-[#3399ff]/30'
                        : 'text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-gray-50 hover:shadow-md hover:border-gray-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-md hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <span className="hidden sm:inline">Next</span>
              <svg className="w-4 h-4 sm:ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmDoc && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Background overlay */}
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setDeleteConfirmDoc(null)}></div>

          {/* Modal */}
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              {/* Header */}
              <div className="flex items-center px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Delete Document</h3>
                    <p className="text-sm text-gray-500">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-4">
                <div className="space-y-4">
                  <p className="text-sm text-gray-700">
                    Are you sure you want to delete the document{' '}
                    <span className="font-medium text-gray-900">"{deleteConfirmDoc.title || deleteConfirmDoc.slug}"</span>?
                  </p>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-yellow-800">Warning</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          This will permanently remove the document and all its associated data from the system.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirmDoc(null)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(deleteConfirmDoc)}
                  disabled={saving}
                  loading={saving}
                >
                  {saving ? 'Deleting...' : 'Delete Document'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editorModalDoc && (
        <DocumentEditorModal
          document={editorModalDoc}
          owners={owners}
          isSuperAdmin={isSuperAdmin}
          onSave={() => {
            setEditorModalDoc(null);
            loadData(); // Refresh the data after saving
          }}
          onCancel={() => setEditorModalDoc(null)}
        />
      )}
    </div>
  );
});

DocumentsTable.displayName = 'DocumentsTable';

