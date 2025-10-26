import { useState, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { DownloadsEditor } from './DownloadsEditor';
import { DocumentEditorModal } from './DocumentEditorModal';
import { getDocuments, updateDocument, deleteDocument, getOwners } from '@/lib/supabase/admin';
import type { DocumentWithOwner, Owner, DownloadLink } from '@/types/admin';
import { useAuth } from '@/hooks/useAuth';

interface DocumentsTableProps {
  isSuperAdmin?: boolean;
}

export function DocumentsTable({ isSuperAdmin = false }: DocumentsTableProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithOwner[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentWithOwner[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloadsModalDoc, setDownloadsModalDoc] = useState<DocumentWithOwner | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<DocumentWithOwner | null>(null);
  const [editorModalDoc, setEditorModalDoc] = useState<DocumentWithOwner | null>(null);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Filter documents based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDocuments(documents);
    } else {
      const filtered = documents.filter(doc => {
        const query = searchQuery.toLowerCase();
        return (
          doc.title?.toLowerCase().includes(query) ||
          doc.subtitle?.toLowerCase().includes(query) ||
          doc.slug?.toLowerCase().includes(query) ||
          doc.category?.toLowerCase().includes(query) ||
          doc.owners?.name?.toLowerCase().includes(query)
        );
      });
      setFilteredDocuments(filtered);
    }
  }, [documents, searchQuery]);

  const loadData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [docs, ownersList] = await Promise.all([
        getDocuments(user.id),
        getOwners(),
      ]);
      setDocuments(docs);
      setOwners(ownersList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDownloads = async (downloads: DownloadLink[]) => {
    if (!downloadsModalDoc) return;

    try {
      setSaving(true);
      await updateDocument(downloadsModalDoc.id, { downloads });

      // Update local state
      setDocuments(docs =>
        docs.map(doc =>
          doc.id === downloadsModalDoc.id ? { ...doc, downloads } : doc
        )
      );

      setDownloadsModalDoc(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save downloads');
    } finally {
      setSaving(false);
    }
  };

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
    const link = `${window.location.origin}/chat?doc=${doc.slug}`;
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




  const renderStatusBadge = (value: boolean) => {
    return value ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 8 8">
          <circle cx="4" cy="4" r="3" />
        </svg>
        Active
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 8 8">
          <circle cx="4" cy="4" r="3" />
        </svg>
        Inactive
      </span>
    );
  };

  const renderVisibilityBadge = (isPublic: boolean, requiresAuth: boolean) => {
    if (isPublic) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
          </svg>
          Public
        </span>
      );
    } else if (!requiresAuth) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Restricted
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Private
        </span>
      );
    }
  };

  const renderActionButtons = (doc: DocumentWithOwner) => {
    return (
      <div className="flex items-center gap-2">
        {/* View Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => window.open(`/chat?doc=${doc.slug}`, '_blank')}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="View document"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <span className="text-xs text-gray-500">View</span>
        </div>

        {/* Copy Link Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => handleCopyLink(doc)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
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
          <span className="text-xs text-gray-500">Copy</span>
        </div>

        {/* Downloads Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setDownloadsModalDoc(doc)}
            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title={`Downloads (${doc.downloads?.length || 0})`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <span className="text-xs text-gray-500">DLs</span>
        </div>

        {/* Edit All Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setEditorModalDoc(doc)}
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Edit all fields"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <span className="text-xs text-gray-500">Edit</span>
        </div>

        {/* Delete Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setDeleteConfirmDoc(doc)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete document"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <span className="text-xs text-gray-500">Delete</span>
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

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Documents ({filteredDocuments.length}{searchQuery ? ` of ${documents.length}` : ''})
          </h3>
          <div className="flex gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {filteredDocuments.filter(doc => doc.active ?? false).length} Active
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {filteredDocuments.filter(doc => doc.is_public ?? false).length} Public
            </span>
          </div>
        </div>
      </div>

      {/* Documents Grid/List */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No documents found' : 'No documents found'}
          </h3>
          <p className="text-gray-500">
            {searchQuery ? `No documents match "${searchQuery}"` : 'Get started by uploading your first document above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Table Header Row */}
          <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="col-span-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Document</div>
            <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</div>
            <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</div>
            <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</div>
            {isSuperAdmin && (
              <div className="col-span-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</div>
            )}
            <div className="col-span-2 text-xs font-medium text-gray-500 uppercase tracking-wider flex justify-center">Actions</div>
          </div>

          {/* Document Rows */}
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200"
            >
              {/* Mobile/Tablet Card View */}
              <div className="lg:hidden p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900">
                          {doc.title || 'Untitled Document'}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {doc.subtitle || doc.slug}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {renderStatusBadge(doc.active ?? false)}
                      {renderVisibilityBadge(doc.is_public ?? false, doc.requires_auth ?? false)}
                      {doc.category && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {doc.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    {doc.year && `Year: ${doc.year}`}
                  </div>
                  {renderActionButtons(doc)}
                </div>
              </div>

              {/* Desktop Grid View */}
              <div className="hidden lg:grid grid-cols-12 gap-4 p-4">
                {/* Document Info */}
                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {doc.title || 'Untitled Document'}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {doc.subtitle || doc.slug}
                      </div>
                      {doc.year && (
                        <div className="text-xs text-gray-400">
                          {doc.year}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2">
                  {renderStatusBadge(doc.active ?? false)}
                </div>

                {/* Visibility */}
                <div className="col-span-2">
                  {renderVisibilityBadge(doc.is_public ?? false, doc.requires_auth ?? false)}
                </div>

                {/* Category */}
                <div className="col-span-2">
                  {doc.category ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {doc.category}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </div>

                {/* Owner (Super Admin only) */}
                {isSuperAdmin && (
                  <div className="col-span-1">
                    <span className="text-sm text-gray-900 truncate">
                      {doc.owners?.name || 'None'}
                    </span>
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

      {downloadsModalDoc && (
        <DownloadsEditor
          downloads={downloadsModalDoc.downloads || []}
          onSave={handleSaveDownloads}
          onCancel={() => setDownloadsModalDoc(null)}
        />
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
}

