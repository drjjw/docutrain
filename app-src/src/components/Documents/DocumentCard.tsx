import React from 'react';
import type { UserDocument } from '@/types/document';
import { Card } from '@/components/UI/Card';
import { Button } from '@/components/UI/Button';
import { DocumentStatus } from './DocumentStatus';
import { formatFileSize, formatRelativeTime } from '@/lib/utils/formatting';
import { deleteDocument } from '@/lib/supabase/database';
import { deleteFile } from '@/lib/supabase/storage';

interface DocumentCardProps {
  document: UserDocument;
  onDelete?: () => void;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      setDeleting(true);
      await deleteFile(document.file_path);
      await deleteDocument(document.id);
      onDelete?.();
    } catch (error) {
      alert('Failed to delete document');
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">{document.title}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {formatRelativeTime(document.created_at)}
            </p>
          </div>
          <DocumentStatus status={document.status} />
        </div>

        {document.file_size && (
          <p className="text-sm text-gray-600">
            Size: {formatFileSize(document.file_size)}
          </p>
        )}

        {document.error_message && (
          <p className="text-sm text-red-600">
            Error: {document.error_message}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            loading={deleting}
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

