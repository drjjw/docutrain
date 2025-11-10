import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import type { Owner } from '@/types/admin';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteEmail: string;
  inviteOwnerId: string | null;
  inviteRole: 'registered' | 'owner_admin';
  isSuperAdmin: boolean;
  isOwnerAdmin: boolean;
  ownerGroups: Array<{ role: string; owner_id: string | null; owner_name: string }>;
  owners: Owner[];
  inviting: boolean;
  onEmailChange: (email: string) => void;
  onOwnerIdChange: (id: string | null) => void;
  onRoleChange: (role: 'registered' | 'owner_admin') => void;
  onConfirm: () => void;
}

export function InviteUserModal({
  isOpen,
  onClose,
  inviteEmail,
  inviteOwnerId,
  inviteRole,
  isSuperAdmin,
  isOwnerAdmin,
  ownerGroups,
  owners,
  inviting,
  onEmailChange,
  onOwnerIdChange,
  onRoleChange,
  onConfirm,
}: InviteUserModalProps) {
  // Disable owner_admin role if owner group is "none"
  const isOwnerAdminDisabled = !inviteOwnerId;

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

        {/* Owner group selector - only for super admins */}
        {isSuperAdmin ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner Group
            </label>
            <select
              value={inviteOwnerId || ''}
              onChange={(e) => {
                const newOwnerId = e.target.value || null;
                onOwnerIdChange(newOwnerId);
                // If "none" is selected and role is owner_admin, reset to registered
                if (!newOwnerId && inviteRole === 'owner_admin') {
                  onRoleChange('registered');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
            >
              <option value="">None (General DocuTrain Access)</option>
              {owners.map(owner => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Select the owner group this user will be added to, or "None" for general access
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
                Users will be added to your owner group as registered users
              </p>
            </div>
          )
        )}

        {/* Role selection - only for super admins */}
        {isSuperAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => onRoleChange(e.target.value as 'registered' | 'owner_admin')}
              disabled={isOwnerAdminDisabled}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm ${
                isOwnerAdminDisabled ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            >
              <option value="registered">Registered User</option>
              <option value="owner_admin" disabled={isOwnerAdminDisabled}>
                Owner Admin
              </option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {isOwnerAdminDisabled 
                ? 'Owner Admin role requires an owner group to be selected'
                : inviteRole === 'owner_admin'
                  ? 'This user will be able to manage the selected owner group'
                  : 'Select the role for this user'}
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={onConfirm}
            disabled={inviting || !inviteEmail || (inviteRole === 'owner_admin' && !inviteOwnerId) || (!isSuperAdmin && !inviteOwnerId)}
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

