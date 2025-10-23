import React, { useState, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { DownloadsEditor } from './DownloadsEditor';
import { DocumentEditorModal } from './DocumentEditorModal';
import { getDocuments, updateDocument, deleteDocument, getOwners } from '@/lib/supabase/admin';
import type { DocumentWithOwner, Owner, DownloadLink } from '@/types/admin';
import { useAuth } from '@/hooks/useAuth';

interface EditingCell {
  documentId: string;
  field: string;
}

export function DocumentsTable() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithOwner[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [downloadsModalDoc, setDownloadsModalDoc] = useState<DocumentWithOwner | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editorModalDoc, setEditorModalDoc] = useState<DocumentWithOwner | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  const handleEdit = (documentId: string, field: string, currentValue: any) => {
    setEditingCell({ documentId, field });
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue(null);
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;

    try {
      setSaving(true);
      await updateDocument(editingCell.documentId, {
        [editingCell.field]: editValue,
      });

      // Update local state
      setDocuments(docs =>
        docs.map(doc =>
          doc.id === editingCell.documentId
            ? { ...doc, [editingCell.field]: editValue }
            : doc
        )
      );

      setEditingCell(null);
      setEditValue(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
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

  const handleDelete = async (id: string) => {
    try {
      setSaving(true);
      await deleteDocument(id);
      setDocuments(docs => docs.filter(doc => doc.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setSaving(false);
    }
  };

  const renderCell = (doc: DocumentWithOwner, field: string, value: any) => {
    const isEditing = editingCell?.documentId === doc.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          {renderEditInput(field, editValue, setEditValue)}
          <Button
            size="sm"
            onClick={handleSaveEdit}
            disabled={saving}
            loading={saving}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancelEdit}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      );
    }

    // Use different styling for title and subtitle to allow line wrapping
    const shouldWrap = field === 'title' || field === 'subtitle';
    const textClass = shouldWrap ? "break-words" : "truncate";

    return (
      <div
        className="group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
        onClick={() => handleEdit(doc.id, field, value)}
      >
        <div className="flex items-center justify-between">
          <span className={textClass}>{renderDisplayValue(field, value)}</span>
          <svg
            className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
      </div>
    );
  };

  const renderEditInput = (field: string, value: any, onChange: (val: any) => void) => {
    switch (field) {
      case 'active':
      case 'show_document_selector':
      case 'is_public':
      case 'requires_auth':
        return (
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        );

      case 'embedding_type':
        return (
          <select
            value={value || 'openai'}
            onChange={(e) => onChange(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="openai">OpenAI</option>
            <option value="local">Local</option>
          </select>
        );

      case 'owner_id':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">None</option>
            {owners.map(owner => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        );

      case 'chunk_limit_override':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
            min="1"
            max="200"
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-24"
          />
        );

      case 'welcome_message':
      case 'intro_message':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Enter message..."
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-full"
          />
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        );
    }
  };

  const renderDisplayValue = (field: string, value: any): string => {
    if (value === null || value === undefined) return '—';

    switch (field) {
      case 'active':
      case 'show_document_selector':
      case 'is_public':
      case 'requires_auth':
        return value ? '✓' : '✗';

      case 'downloads':
        if (!value || !Array.isArray(value) || value.length === 0) return '0';
        return `${value.length}`;

      case 'metadata':
        return JSON.stringify(value).substring(0, 50) + '...';

      case 'owner_id':
        const owner = owners.find(o => o.id === value);
        return owner ? owner.name : value;

      case 'created_at':
      case 'updated_at':
        return new Date(value).toLocaleDateString();

      default:
        return String(value);
    }
  };

  const renderDownloadsCell = (doc: DocumentWithOwner) => {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">
          {renderDisplayValue('downloads', doc.downloads)}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDownloadsModalDoc(doc)}
        >
          Edit
        </Button>
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
    <div className="space-y-4">
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Subtitle
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Slug
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Year
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Public
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Auth
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                DLs
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((doc) => (
              <React.Fragment key={doc.id}>
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900 min-w-[300px]">
                  {renderCell(doc, 'title', doc.title)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 min-w-[300px]">
                  {renderCell(doc, 'subtitle', doc.subtitle)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                  {renderCell(doc, 'slug', doc.slug)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(doc, 'category', doc.category)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(doc, 'owner_id', doc.owner_id)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(doc, 'year', doc.year)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(doc, 'active', doc.active)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(doc, 'is_public', doc.is_public)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderCell(doc, 'requires_auth', doc.requires_auth)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {renderDownloadsCell(doc)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditorModalDoc(doc)}
                    >
                      Edit All
                    </Button>
                    {deleteConfirmId === doc.id ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(doc.id)}
                          disabled={saving}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirmId(null)}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setDeleteConfirmId(doc.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {documents.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No documents found
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

