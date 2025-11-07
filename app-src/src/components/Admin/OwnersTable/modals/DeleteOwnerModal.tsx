import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import type { Owner } from '@/types/admin';

interface DeleteOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerId: string | null;
  owner: Owner | null;
  saving: boolean;
  onConfirm: (ownerId: string) => void;
}

export function DeleteOwnerModal({
  isOpen,
  onClose,
  ownerId,
  owner,
  saving,
  onConfirm,
}: DeleteOwnerModalProps) {
  if (!ownerId || !owner) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Owner"
      size="md"
    >
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            <strong>Warning:</strong> Deleting an owner will affect all documents associated with it. 
            This action cannot be undone.
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-700 mb-2">
            Are you sure you want to delete the following owner?
          </p>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900">{owner.name}</p>
            <p className="text-sm text-gray-600 mt-1">Slug: <code className="bg-gray-200 px-1.5 py-0.5 rounded">{owner.slug}</code></p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(ownerId)}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {saving ? 'Deleting...' : 'Delete Owner'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

