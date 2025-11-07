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
    <div className="bg-docutrain-light/10 border border-docutrain-light/30 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-docutrain-dark">
          {selectedCount} document{selectedCount !== 1 ? 's' : ''} selected
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onClearSelection}
          className="px-4 py-2 text-sm font-medium text-docutrain-dark hover:text-docutrain-medium hover:bg-docutrain-light/20 rounded-lg transition-colors"
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

