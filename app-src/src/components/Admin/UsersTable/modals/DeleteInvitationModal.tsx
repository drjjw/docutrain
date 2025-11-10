import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import type { PendingInvitation } from '@/types/admin';

interface DeleteInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletingInvitationId: string | null;
  pendingInvitations: PendingInvitation[];
  saving: boolean;
  onConfirm: (invitationId: string) => void;
}

export function DeleteInvitationModal({
  isOpen,
  onClose,
  deletingInvitationId,
  pendingInvitations,
  saving,
  onConfirm,
}: DeleteInvitationModalProps) {
  if (!deletingInvitationId) return null;

  const invitation = pendingInvitations.find(inv => inv.id === deletingInvitationId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Invitation"
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this pending invitation? This action cannot be undone.
        </p>
        {invitation && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-700 mb-1">Invitation Details:</div>
            <div className="text-sm text-gray-600">
              <div>Email: <strong>{invitation.email}</strong></div>
              <div>Owner Group: <strong>{invitation.owner_name}</strong></div>
            </div>
          </div>
        )}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-red-700 font-medium">
                This action cannot be undone
              </p>
              <p className="mt-1 text-xs text-red-600">
                The invitation will be permanently deleted and cannot be recovered.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="danger"
            onClick={() => deletingInvitationId && onConfirm(deletingInvitationId)}
            disabled={saving}
            loading={saving}
            className="flex-1"
          >
            Delete Invitation
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



