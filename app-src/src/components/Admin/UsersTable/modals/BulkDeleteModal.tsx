import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import type { UserWithRoles, PendingInvitation } from '@/types/admin';

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUserIds: Set<string>;
  selectedInvitationIds: Set<string>;
  users: UserWithRoles[];
  pendingInvitations: PendingInvitation[];
  selectedCount: number;
  saving: boolean;
  onConfirm: () => void;
}

export function BulkDeleteModal({
  isOpen,
  onClose,
  selectedUserIds,
  selectedInvitationIds,
  users,
  pendingInvitations,
  selectedCount,
  saving,
  onConfirm,
}: BulkDeleteModalProps) {
  const userCount = selectedUserIds.size;
  const invitationCount = selectedInvitationIds.size;
  const items = [];
  if (userCount > 0) items.push(`${userCount} user${userCount !== 1 ? 's' : ''}`);
  if (invitationCount > 0) items.push(`${invitationCount} invitation${invitationCount !== 1 ? 's' : ''}`);
  const itemLabel = items.join(' and ');
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Multiple Items"
      size="md"
    >
      <div className="space-y-4">
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
                This will permanently delete {itemLabel} and all associated data.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
          <div className="text-xs font-medium text-gray-700 mb-2">Items to be deleted:</div>
          <div className="space-y-1">
            {Array.from(selectedUserIds).map(userId => {
              const user = users.find(u => u.id === userId);
              return user ? (
                <div key={userId} className="text-sm text-gray-600">
                  • {user.email} (User)
                </div>
              ) : null;
            })}
            {Array.from(selectedInvitationIds).map(invitationId => {
              const invitation = pendingInvitations.find(i => i.id === invitationId);
              return invitation ? (
                <div key={invitationId} className="text-sm text-gray-600">
                  • {invitation.email} (Invitation)
                </div>
              ) : null;
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={saving}
            loading={saving}
            className="flex-1"
          >
            Delete {itemLabel}
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


