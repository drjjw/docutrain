import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import type { Owner } from '@/types/admin';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteEmail: string;
  inviteOwnerId: string | null;
  isSuperAdmin: boolean;
  isOwnerAdmin: boolean;
  ownerGroups: Array<{ role: string; owner_id: string | null; owner_name: string }>;
  owners: Owner[];
  inviting: boolean;
  onEmailChange: (email: string) => void;
  onOwnerIdChange: (id: string | null) => void;
  onConfirm: () => void;
}

export function InviteUserModal({
  isOpen,
  onClose,
  inviteEmail,
  inviteOwnerId,
  isSuperAdmin,
  isOwnerAdmin,
  ownerGroups,
  owners,
  inviting,
  onEmailChange,
  onOwnerIdChange,
  onConfirm,
}: InviteUserModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite User"
      size="md"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
            placeholder="user@example.com"
            autoFocus
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter the email address of the user you want to invite
          </p>
        </div>

        {/* Only show owner group selector for super admins */}
        {isSuperAdmin ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner Group
            </label>
            <select
              value={inviteOwnerId || ''}
              onChange={(e) => onOwnerIdChange(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
            >
              <option value="">Select Owner Group</option>
              {owners.map(owner => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select the owner group this user will be added to
            </p>
          </div>
        ) : (
          // For owner admins, show which group they're inviting to (read-only)
          ownerGroups.filter(og => og.role === 'owner_admin' && og.owner_id).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Owner Group
              </label>
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-700">
                {(() => {
                  const adminGroup = ownerGroups.find(og => og.role === 'owner_admin' && og.owner_id);
                  return adminGroup?.owner_name || 'Unknown';
                })()}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Users will be added to your owner group
              </p>
            </div>
          )
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={onConfirm}
            disabled={inviting || !inviteEmail || (isSuperAdmin && !inviteOwnerId)}
            loading={inviting}
            className="flex-1"
          >
            Send Invitation
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={inviting}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}

