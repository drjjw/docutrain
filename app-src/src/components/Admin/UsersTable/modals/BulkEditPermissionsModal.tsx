import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import type { Owner } from '@/types/admin';

interface BulkEditPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  bulkRole: 'registered' | 'owner_admin' | 'super_admin';
  bulkOwnerId: string | null;
  owners: Owner[];
  saving: boolean;
  onRoleChange: (role: 'registered' | 'owner_admin' | 'super_admin') => void;
  onOwnerIdChange: (id: string | null) => void;
  onConfirm: () => void;
}

export function BulkEditPermissionsModal({
  isOpen,
  onClose,
  selectedCount,
  bulkRole,
  bulkOwnerId,
  owners,
  saving,
  onRoleChange,
  onOwnerIdChange,
  onConfirm,
}: BulkEditPermissionsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Assign Role & Permissions"
      size="md"
    >
      <div className="space-y-6">
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">Selected Users</div>
          <div className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            {selectedCount} user{selectedCount !== 1 ? 's' : ''} selected
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <select
            value={bulkRole}
            onChange={(e) => {
              const newRole = e.target.value as 'registered' | 'owner_admin' | 'super_admin';
              onRoleChange(newRole);
              if (newRole === 'super_admin') {
                onOwnerIdChange(null);
              } else if ((newRole === 'owner_admin' || newRole === 'registered') && !bulkOwnerId) {
                onOwnerIdChange(owners[0]?.id || null);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
          >
            <option value="registered">Registered User</option>
            <option value="owner_admin">Owner Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {bulkRole === 'registered' && 'Basic access to assigned owner groups'}
            {bulkRole === 'owner_admin' && 'Can manage documents and users for assigned owner group'}
            {bulkRole === 'super_admin' && 'Full system-wide administrative access'}
          </p>
        </div>

        {(bulkRole === 'owner_admin' || bulkRole === 'registered') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner Group
            </label>
            <select
              value={bulkOwnerId || ''}
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
              {bulkRole === 'owner_admin'
                ? 'Select the owner group these users will administer'
                : 'Select the owner group these users will have access to'}
            </p>
          </div>
        )}

        {bulkRole === 'super_admin' && (
          <div className="bg-docutrain-light/10 border border-docutrain-light/30 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-docutrain-light" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-docutrain-dark">
                  Super Admins have access to all documents and can manage all users across the system.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={onConfirm}
            disabled={saving || ((bulkRole === 'owner_admin' || bulkRole === 'registered') && !bulkOwnerId)}
            loading={saving}
            className="flex-1"
          >
            Assign to {selectedCount} User{selectedCount !== 1 ? 's' : ''}
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

