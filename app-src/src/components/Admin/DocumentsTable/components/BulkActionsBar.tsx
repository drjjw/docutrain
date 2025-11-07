import React from 'react';
import { Button } from '@/components/UI/Button';

interface BulkActionsBarProps {
  selectedCount: number;
  saving: boolean;
  onClearSelection: () => void;
  onBulkDelete: () => void;
}

export function BulkActionsBar({
  selectedCount,
  saving,
  onClearSelection,
  onBulkDelete,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-blue-900">
          {selectedCount} document{selectedCount !== 1 ? 's' : ''} selected
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onClearSelection}
          className="px-4 py-2 text-sm font-medium text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors"
        >
          Clear Selection
        </button>
        <Button
          variant="danger"
          size="sm"
          onClick={onBulkDelete}
          loading={saving}
          disabled={saving}
        >
          Delete Selected ({selectedCount})
        </Button>
      </div>
    </div>
  );
}

