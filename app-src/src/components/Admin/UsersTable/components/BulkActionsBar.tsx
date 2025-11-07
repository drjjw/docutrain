import { Button } from '@/components/UI/Button';

interface BulkActionsBarProps {
  selectedCount: number;
  saving: boolean;
  onAssignRole: () => void;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedCount,
  saving,
  onAssignRole,
  onDeleteSelected,
  onClearSelection,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-docutrain-light/10 border border-docutrain-light/30 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-docutrain-dark">
            {selectedCount} user{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={onAssignRole}
            disabled={saving}
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Assign Role
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={onDeleteSelected}
            disabled={saving}
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected
          </Button>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onClearSelection}
          disabled={saving}
        >
          Clear Selection
        </Button>
      </div>
    </div>
  );
}

