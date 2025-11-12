import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { DocumentEditorModal } from '../DocumentEditorModal';
import { DocumentConfigPromptModal } from '../DocumentConfigPromptModal';
import { DocumentAnalyticsModal } from '../DocumentAnalyticsModal';
import { deleteDocument, updateDocument } from '@/lib/supabase/admin';
import type { DocumentWithOwner } from '@/types/admin';
import { useDocumentsData } from './hooks/useDocumentsData';
import { useDocumentsFiltering } from './hooks/useDocumentsFiltering';
import { useDocumentsPagination } from './hooks/useDocumentsPagination';
import { useDocumentsSelection } from './hooks/useDocumentsSelection';
import { DocumentFilters } from './components/DocumentFilters';
import { DocumentRow } from './components/DocumentRow';
import { DocumentCard } from './components/DocumentCard';
import { BulkActionsBar } from './components/BulkActionsBar';
import { PaginationControls } from './components/PaginationControls';
import { DeleteConfirmModal } from './modals/DeleteConfirmModal';
import { BulkDeleteModal } from './modals/BulkDeleteModal';
import type { DocumentsTableProps, DocumentsTableRef, BulkDeleteProgress } from './types';
import { debugLog } from '@/utils/debug';

export const DocumentsTable = forwardRef<DocumentsTableRef, DocumentsTableProps>((props, ref) => {
  const { isSuperAdmin = false, onRetrainingStart, onRetrainSuccess } = props;
  
  // Data management
  const { documents, owners, loading, error, documentsRef, loadData, updateDocumentInState } = useDocumentsData();
  
  // Filtering
  const {
    filteredDocuments,
    searchQuery,
    statusFilter,
    visibilityFilter,
    categoryFilter,
    ownerFilter,
    setSearchQuery,
    setStatusFilter,
    setVisibilityFilter,
    setCategoryFilter,
    setOwnerFilter,
    clearAllFilters,
  } = useDocumentsFiltering({
    documents,
    isSuperAdmin,
  });
  
  // Pagination
  const {
    paginatedDocuments,
    currentPage,
    itemsPerPage,
    totalPages,
    startIndex,
    endIndex,
    setCurrentPage,
    setItemsPerPage,
  } = useDocumentsPagination({
    filteredDocuments,
  });
  
  // Selection
  const {
    selectedDocIds,
    isAllSelected,
    isSomeSelected,
    selectAllCheckboxRef,
    toggleDocumentSelection,
    toggleSelectAll,
    clearSelection,
  } = useDocumentsSelection({
    paginatedDocuments,
  });
  
  // Local state
  const [saving, setSaving] = useState(false);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<DocumentWithOwner | null>(null);
  const [editorModalDoc, setEditorModalDoc] = useState<DocumentWithOwner | null>(null);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  const [copiedSlugId, setCopiedSlugId] = useState<string | null>(null);
  const [updatingDocIds, setUpdatingDocIds] = useState<Set<string>>(new Set());
  const [showConfigPrompt, setShowConfigPrompt] = useState(false);
  const [configPromptDoc, setConfigPromptDoc] = useState<DocumentWithOwner | null>(null);
  const [analyticsDoc, setAnalyticsDoc] = useState<DocumentWithOwner | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleteDocs, setBulkDeleteDocs] = useState<DocumentWithOwner[]>([]);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<BulkDeleteProgress | null>(null);

  // Debug editorModalDoc changes and prevent unnecessary updates
  const prevEditorModalDocIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const currentId = editorModalDoc?.id || null;
    if (currentId !== prevEditorModalDocIdRef.current) {
      debugLog('DocumentsTable: editorModalDoc changed:', currentId || 'null');
      prevEditorModalDocIdRef.current = currentId;
    }
  }, [editorModalDoc]);

  // Sync editorModalDoc with refreshed document data to prevent stale references
  // Only update if the document's updated_at timestamp changed (meaning it was actually updated)
  const editorModalDocUpdatedAtRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!editorModalDoc) {
      editorModalDocUpdatedAtRef.current = null;
      return;
    }
    
    // Initialize the ref on first set
    if (!editorModalDocUpdatedAtRef.current) {
      editorModalDocUpdatedAtRef.current = editorModalDoc.updated_at || null;
      return;
    }
    
    if (documents.length === 0) return;
    
    // Find the updated document in the refreshed list
    const updatedDoc = documents.find(d => d.id === editorModalDoc.id);
    if (updatedDoc) {
      const newUpdatedAt = updatedDoc.updated_at || null;
      // Only sync if updated_at actually changed (document was modified)
      if (newUpdatedAt !== editorModalDocUpdatedAtRef.current) {
        debugLog('DocumentsTable: Syncing editorModalDoc with refreshed document data (updated_at changed)');
        editorModalDocUpdatedAtRef.current = newUpdatedAt;
        setEditorModalDoc(updatedDoc);
      }
    }
  }, [documents, editorModalDoc]);

  // Prevent body scroll when delete modal is open
  useEffect(() => {
    if (deleteConfirmDoc || bulkDeleteConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [deleteConfirmDoc, bulkDeleteConfirm]);

  // Clear selection when filters or page changes
  useEffect(() => {
    clearSelection();
  }, [searchQuery, statusFilter, visibilityFilter, categoryFilter, ownerFilter, currentPage]);

  // Expose refresh method and openEditorModal via ref
  useImperativeHandle(ref, () => ({
    refresh: () => loadData(false),
    openEditorModal: async (documentId: string, showPrompt = false) => {
      // Refresh documents to ensure we have the latest data
      await loadData(false);
      // Use setTimeout to ensure state has updated after loadData
      setTimeout(() => {
        // Find the document by ID from ref (which is updated synchronously)
        const doc = documentsRef.current.find(d => d.id === documentId);
        if (doc) {
          if (showPrompt) {
            // Show the prompt modal first
            setConfigPromptDoc(doc);
            setShowConfigPrompt(true);
          } else {
            // Open editor directly
            setEditorModalDoc(doc);
            setShowConfigPrompt(false);
          }
        } else {
          console.warn(`Document not found: ${documentId}`);
          // Retry after a shorter delay in case document is still being created
          setTimeout(async () => {
            await loadData(false);
            setTimeout(() => {
              const retryDoc = documentsRef.current.find(d => d.id === documentId);
              if (retryDoc) {
                if (showPrompt) {
                  setConfigPromptDoc(retryDoc);
                  setShowConfigPrompt(true);
                } else {
                  setEditorModalDoc(retryDoc);
                  setShowConfigPrompt(false);
                }
              }
            }, 200);
          }, 1000);
        }
      }, 200);
    },
  }), [loadData, documentsRef]);

  // Handlers
  const handleDelete = async (doc: DocumentWithOwner) => {
    try {
      setSaving(true);
      await deleteDocument(doc.id);
      // Remove from selection if it was selected
      clearSelection();
      setDeleteConfirmDoc(null);
      // Reload data to reflect deletion
      await loadData(false);
    } catch (err) {
      // Error is handled by the data hook
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedDocIds.size === 0) return;
    const selectedDocs = documents.filter(doc => selectedDocIds.has(doc.id));
    setBulkDeleteDocs(selectedDocs);
    setBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedDocIds.size === 0) return;

    const docIdsArray = Array.from(selectedDocIds);
    const deletedIds: string[] = [];
    const failedItems: Array<{ id: string; error: string }> = [];
    
    // Initialize progress tracking
    setBulkDeleteProgress({
      current: null,
      completed: [],
      failed: [],
      total: docIdsArray.length,
    });
    setSaving(true);
    
    try {
      // Delete documents sequentially to avoid timeouts and database locks
      for (const docId of docIdsArray) {
        const doc = bulkDeleteDocs.find(d => d.id === docId);
        
        // Update current document being deleted
        setBulkDeleteProgress(prev => prev ? {
          ...prev,
          current: docId,
        } : null);
        
        try {
          await deleteDocument(docId);
          deletedIds.push(docId);
          
          // Update progress
          setBulkDeleteProgress(prev => prev ? {
            ...prev,
            current: null,
            completed: [...prev.completed, docId],
          } : null);
          
          // Small delay between deletions to avoid overwhelming the database
          if (docIdsArray.length > 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (err) {
          console.error(`Failed to delete document ${docId}:`, err);
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          failedItems.push({ id: docId, error: errorMessage });
          
          // Update progress
          setBulkDeleteProgress(prev => prev ? {
            ...prev,
            current: null,
            failed: [...prev.failed, { id: docId, error: errorMessage }],
          } : null);
        }
      }
      
      // Reload data to reflect deletions
      if (deletedIds.length > 0) {
        await loadData(false);
      }
      
      // Clear selection
      clearSelection();
      
      // Show error if some deletions failed
      if (failedItems.length > 0) {
        const successCount = deletedIds.length;
        const failCount = failedItems.length;
        // Error will be shown via the error state from the data hook
      }
      
      // Auto-dismiss modal after a short delay if all succeeded
      if (failedItems.length === 0) {
        setTimeout(() => {
          setBulkDeleteConfirm(false);
          setBulkDeleteDocs([]);
          setBulkDeleteProgress(null);
        }, 1500);
      }
    } catch (err) {
      // Error handled
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async (doc: DocumentWithOwner) => {
    const link = `${window.location.origin}/app/chat?doc=${doc.slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedDocId(doc.id);
      setTimeout(() => setCopiedDocId(null), 2000);
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
        // Error handled
      }
      document.body.removeChild(textArea);
    }
  };

  const handleCopySlug = async (doc: DocumentWithOwner) => {
    try {
      await navigator.clipboard.writeText(doc.slug);
      setCopiedSlugId(doc.id);
      setTimeout(() => setCopiedSlugId(null), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = doc.slug;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedSlugId(doc.id);
        setTimeout(() => setCopiedSlugId(null), 2000);
      } catch (fallbackErr) {
        // Error handled
      }
      document.body.removeChild(textArea);
    }
  };

  const handleToggleActive = async (doc: DocumentWithOwner, newActive: boolean) => {
    setUpdatingDocIds(prev => new Set(prev).add(doc.id));
    
    // Optimistically update the UI immediately
    updateDocumentInState(doc.id, { active: newActive });
    
    try {
      await updateDocument(doc.id, { active: newActive, slug: doc.slug });
      
      // Dispatch event to trigger refresh in other tabs/components
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('document-updated', {
          detail: { documentSlug: doc.slug }
        }));
      }, 200);
      
      // Note: We don't need to reload data here because:
      // 1. We've already optimistically updated the state
      // 2. Realtime subscription will handle cross-tab/window updates
      // 3. This makes the toggle feel instant
    } catch (err) {
      // On error, revert the optimistic update and reload to get correct state
      updateDocumentInState(doc.id, { active: !newActive });
      await loadData(false);
    } finally {
      setUpdatingDocIds(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const handleUpdateVisibility = async (doc: DocumentWithOwner, newAccessLevel: string) => {
    setUpdatingDocIds(prev => new Set(prev).add(doc.id));
    
    // Optimistically update the UI immediately
    updateDocumentInState(doc.id, { access_level: newAccessLevel as any });
    
    try {
      await updateDocument(doc.id, { access_level: newAccessLevel as any, slug: doc.slug });
      
      // Dispatch event to trigger refresh in other tabs/components
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('document-updated', {
          detail: { documentSlug: doc.slug }
        }));
      }, 200);
    } catch (err) {
      // On error, revert the optimistic update and reload to get correct state
      updateDocumentInState(doc.id, { access_level: doc.access_level });
      await loadData(false);
    } finally {
      setUpdatingDocIds(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const handleUpdateCategory = async (doc: DocumentWithOwner, newCategory: string | null) => {
    setUpdatingDocIds(prev => new Set(prev).add(doc.id));
    
    try {
      // Find or create category and get its ID
      let categoryId: number | null = null;
      if (newCategory) {
        const { findOrCreateCategory } = await import('@/lib/supabase/admin');
        categoryId = await findOrCreateCategory(newCategory, doc.owner_id || null);
      }
      
      // Update document with category_id only
      await updateDocument(doc.id, { 
        category_id: categoryId,
        slug: doc.slug 
      });
      
      // Optimistically update the UI - update category_obj
      if (categoryId && newCategory) {
        updateDocumentInState(doc.id, { 
          category_id: categoryId,
          category_obj: { id: categoryId, name: newCategory }
        });
      } else {
        updateDocumentInState(doc.id, { 
          category_id: null,
          category_obj: undefined
        });
      }
      
      // Dispatch event to trigger refresh in other tabs/components
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('document-updated', {
          detail: { documentSlug: doc.slug }
        }));
      }, 200);
    } catch (err) {
      // On error, reload to get correct state
      await loadData(false);
    } finally {
      setUpdatingDocIds(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const handleUpdateOwner = async (doc: DocumentWithOwner, newOwnerId: string | null) => {
    setUpdatingDocIds(prev => new Set(prev).add(doc.id));
    
    // Optimistically update the UI immediately
    const newOwner = newOwnerId ? owners.find(o => o.id === newOwnerId) : undefined;
    updateDocumentInState(doc.id, { owner_id: newOwnerId, owners: newOwner });
    
    try {
      await updateDocument(doc.id, { owner_id: newOwnerId, slug: doc.slug });
      
      // Dispatch event to trigger refresh in other tabs/components
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('document-updated', {
          detail: { documentSlug: doc.slug }
        }));
      }, 200);
    } catch (err) {
      // On error, revert the optimistic update and reload to get correct state
      updateDocumentInState(doc.id, { owner_id: doc.owner_id, owners: doc.owners });
      await loadData(false);
    } finally {
      setUpdatingDocIds(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const handleUpdateTitle = async (doc: DocumentWithOwner, newTitle: string) => {
    setUpdatingDocIds(prev => new Set(prev).add(doc.id));
    
    // Optimistically update the UI immediately
    updateDocumentInState(doc.id, { title: newTitle });
    
    try {
      await updateDocument(doc.id, { title: newTitle, slug: doc.slug });
      
      // Dispatch event to trigger refresh in other tabs/components
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('document-updated', {
          detail: { documentSlug: doc.slug }
        }));
      }, 200);
    } catch (err) {
      // On error, revert the optimistic update and reload to get correct state
      updateDocumentInState(doc.id, { title: doc.title });
      await loadData(false);
    } finally {
      setUpdatingDocIds(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const handleDownload = async (doc: DocumentWithOwner) => {
    try {
      const response = await fetch(`/api/document-download-url/${doc.id}`);
      const data = await response.json();
      
      if (data.success && data.url) {
        window.open(data.url, '_blank');
      } else {
        // Error will be shown via error state
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const hasDownloadAvailable = (doc: DocumentWithOwner): boolean => {
    return doc.pdf_subdirectory === 'user-uploads' && !!doc.pdf_filename;
  };

  const handleClearFilters = () => {
    clearAllFilters();
    setCurrentPage(1);
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
        <Alert variant="error" onDismiss={() => {}}>
          {error}
        </Alert>
      )}

      {/* Search and Filters */}
      <DocumentFilters
        searchQuery={searchQuery}
        statusFilter={statusFilter}
        visibilityFilter={visibilityFilter}
        categoryFilter={categoryFilter}
        ownerFilter={ownerFilter}
        owners={owners}
        isSuperAdmin={isSuperAdmin}
        totalDocuments={documents.length}
        filteredDocuments={filteredDocuments.length}
        onSearchChange={setSearchQuery}
        onStatusFilterChange={setStatusFilter}
        onVisibilityFilterChange={setVisibilityFilter}
        onCategoryFilterChange={setCategoryFilter}
        onOwnerFilterChange={setOwnerFilter}
        onClearFilters={handleClearFilters}
      />

      {/* Table Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
            Documents ({paginatedDocuments.length} of {filteredDocuments.length}{filteredDocuments.length !== documents.length ? ` total` : ''})
          </h3>
        </div>
        {/* Items per page selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Show:</span>
          <select
            value={itemsPerPage >= filteredDocuments.length && filteredDocuments.length > 0 ? 'all' : itemsPerPage}
            onChange={(e) => {
              const newValue = e.target.value;
              if (newValue === 'all') {
                setItemsPerPage(filteredDocuments.length);
              } else {
                setItemsPerPage(Number(newValue));
              }
            }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 focus:border-docutrain-light bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 font-medium text-gray-700"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            {filteredDocuments.length > 0 && (
              <option value="all">All ({filteredDocuments.length})</option>
            )}
          </select>
          <span className="text-sm text-gray-600 hidden sm:inline font-medium">per page</span>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedDocIds.size}
        saving={saving}
        onClearSelection={clearSelection}
        onBulkDelete={handleBulkDelete}
      />

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
        <div className="space-y-5">
          {/* Table Header Row */}
          <div className="hidden lg:flex px-5 py-4 bg-gray-50 rounded-xl border border-gray-200/60 shadow-sm">
            <div className="flex items-center justify-center w-8 flex-shrink-0 mr-4">
              <input
                type="checkbox"
                ref={selectAllCheckboxRef}
                checked={isAllSelected}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-docutrain-light bg-gray-100 border-gray-300 rounded focus:ring-docutrain-light focus:ring-2 cursor-pointer"
                title={isAllSelected ? 'Deselect all' : isSomeSelected ? 'Some selected' : 'Select all'}
              />
            </div>
            <div className={`${isSuperAdmin ? 'flex-1 min-w-[400px] mr-4' : 'flex-1 min-w-[400px] mr-4'} text-xs font-bold text-gray-600 uppercase tracking-wider`}>Document</div>
            <div className="w-28 text-xs font-bold text-gray-600 uppercase tracking-wider text-center mr-6">Visibility</div>
            <div className="w-28 text-xs font-bold text-gray-600 uppercase tracking-wider text-center mr-6">Category</div>
            {isSuperAdmin && (
              <div className="w-28 text-xs font-bold text-gray-600 uppercase tracking-wider text-center mr-6">Owner</div>
            )}
            <div className="flex-1 text-xs font-bold text-gray-600 uppercase tracking-wider flex justify-center">Actions</div>
          </div>

          {/* Document Rows */}
          {paginatedDocuments.map((doc) => {
            const isUpdating = updatingDocIds.has(doc.id);
            const hasDownload = hasDownloadAvailable(doc);
            const commonProps = {
              doc,
              isSelected: selectedDocIds.has(doc.id),
              isUpdating,
              copiedDocId,
              copiedSlugId,
              hasDownload,
              onToggleSelection: toggleDocumentSelection,
              onCopySlug: handleCopySlug,
              onToggleActive: handleToggleActive,
              onView: (slug: string) => window.open(`/app/chat?doc=${slug}`, '_blank'),
              onDownload: handleDownload,
              onCopyLink: handleCopyLink,
              onViewAnalytics: setAnalyticsDoc,
              onEdit: (doc: DocumentWithOwner) => {
                setShowConfigPrompt(false);
                setConfigPromptDoc(null);
                setEditorModalDoc(doc);
              },
              onDelete: setDeleteConfirmDoc,
              onUpdateVisibility: (doc: DocumentWithOwner, newAccessLevel: string) => handleUpdateVisibility(doc, newAccessLevel),
              onUpdateCategory: (doc: DocumentWithOwner, newCategory: string | null) => handleUpdateCategory(doc, newCategory),
              onUpdateOwner: (doc: DocumentWithOwner, newOwnerId: string | null) => handleUpdateOwner(doc, newOwnerId),
              onUpdateTitle: (doc: DocumentWithOwner, newTitle: string) => handleUpdateTitle(doc, newTitle),
            };
            
            return (
              <div key={doc.id}>
                <DocumentCard {...commonProps} isSuperAdmin={isSuperAdmin} owners={owners} />
                <DocumentRow {...commonProps} isSuperAdmin={isSuperAdmin} owners={owners} />
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        totalDocuments={filteredDocuments.length}
        onPageChange={setCurrentPage}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        doc={deleteConfirmDoc}
        saving={saving}
        onClose={() => setDeleteConfirmDoc(null)}
        onConfirm={handleDelete}
      />

      {/* Bulk Delete Confirmation Modal */}
      <BulkDeleteModal
        isOpen={bulkDeleteConfirm}
        docs={bulkDeleteDocs}
        saving={saving}
        progress={bulkDeleteProgress}
        onClose={() => {
          if (!saving) {
            setBulkDeleteConfirm(false);
            setBulkDeleteDocs([]);
            setBulkDeleteProgress(null);
          }
        }}
        onConfirm={confirmBulkDelete}
      />

      {/* Editor Modal */}
      {editorModalDoc && (
        <DocumentEditorModal
          key={editorModalDoc.id}
          document={editorModalDoc}
          owners={owners}
          isSuperAdmin={isSuperAdmin}
          onSave={() => {
            setEditorModalDoc(null);
            setShowConfigPrompt(false);
            setConfigPromptDoc(null);
            loadData();
          }}
          onCancel={() => {
            setEditorModalDoc(null);
            setShowConfigPrompt(false);
            setConfigPromptDoc(null);
          }}
          onRetrainingStart={onRetrainingStart}
          onRetrainSuccess={onRetrainSuccess}
        />
      )}

      {/* Configuration Prompt Modal */}
      {configPromptDoc && (
        <DocumentConfigPromptModal
          document={configPromptDoc}
          isOpen={showConfigPrompt}
          onConfigure={() => {
            setShowConfigPrompt(false);
            setConfigPromptDoc(null);
            setEditorModalDoc(configPromptDoc);
          }}
          onDismiss={() => {
            setShowConfigPrompt(false);
            setConfigPromptDoc(null);
          }}
        />
      )}

      {/* Analytics Modal */}
      {analyticsDoc && (
        <DocumentAnalyticsModal
          document={analyticsDoc}
          isOpen={!!analyticsDoc}
          onClose={() => setAnalyticsDoc(null)}
        />
      )}
    </div>
  );
});

DocumentsTable.displayName = 'DocumentsTable';

export type { DocumentsTableRef } from './types';

