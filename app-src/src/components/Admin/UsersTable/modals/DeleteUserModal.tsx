import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';

interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  deleteConfirmId: string | null;
  deleteAction: 'delete' | 'ban';
  saving: boolean;
  onActionChange: (action: 'delete' | 'ban') => void;
  onConfirm: (userId: string) => void;
}

export function DeleteUserModal({
  isOpen,
  onClose,
  deleteConfirmId,
  deleteAction,
  saving,
  onActionChange,
  onConfirm,
}: DeleteUserModalProps) {
  if (!deleteConfirmId) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={deleteAction === 'ban' ? 'Ban User' : 'Delete User'}
      size="sm"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Action
          </label>
          <select
            value={deleteAction}
            onChange={(e) => onActionChange(e.target.value as 'delete' | 'ban')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="delete">Permanently Delete</option>
            <option value="ban">Ban (Temporary Block)</option>
          </select>
        </div>

        <div className={`${deleteAction === 'delete' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4`}>
          <div className="flex">
            <svg className={`h-5 w-5 ${deleteAction === 'delete' ? 'text-red-400' : 'text-yellow-400'}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              {deleteAction === 'delete' ? (
                <>
                  <p className="text-sm text-red-700 font-medium">
                    This action cannot be undone
                  </p>
                  <p className="mt-1 text-xs text-red-600">
                    This will permanently delete the user and all associated data.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-yellow-700 font-medium">
                    User will be banned permanently
                  </p>
                  <p className="mt-1 text-xs text-yellow-600">
                    The user will not be able to log in. You can unban them later.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="danger"
            onClick={() => onConfirm(deleteConfirmId)}
            disabled={saving}
            loading={saving}
            className="flex-1"
          >
            {deleteAction === 'ban' ? 'Ban User' : 'Delete User'}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

