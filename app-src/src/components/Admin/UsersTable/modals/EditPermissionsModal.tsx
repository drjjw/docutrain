import { Button } from '@/components/UI/Button';
import { Modal } from '@/components/UI/Modal';
import type { Owner } from '@/types/admin';
import type { EditingPermissions } from '../types';

interface EditPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPermissions: EditingPermissions | null;
  editRole: 'registered' | 'owner_admin' | 'super_admin';
  editOwnerId: string | null;
  editEmail: string;
  editFirstName: string;
  editLastName: string;
  owners: Owner[];
  currentUserId: string | undefined;
  saving: boolean;
  onSave: () => void;
  onRoleChange: (role: 'registered' | 'owner_admin' | 'super_admin') => void;
  onOwnerIdChange: (id: string | null) => void;
  onEmailChange: (email: string) => void;
  onFirstNameChange: (name: string) => void;
  onLastNameChange: (name: string) => void;
}

export function EditPermissionsModal({
  isOpen,
  onClose,
  editingPermissions,
  editRole,
  editOwnerId,
  editEmail,
  editFirstName,
  editLastName,
  owners,
  currentUserId,
  saving,
  onSave,
  onRoleChange,
  onOwnerIdChange,
  onEmailChange,
  onFirstNameChange,
  onLastNameChange,
}: EditPermissionsModalProps) {
  const isEditingSelf = currentUserId === editingPermissions?.userId;
  const currentHasSuperAdmin = editingPermissions?.role === 'super_admin';
  const isSelfSuperAdmin = isEditingSelf && currentHasSuperAdmin;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit User"
      size="md"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            type="email"
            value={editEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="user@example.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              First Name
            </label>
            <input
              type="text"
              value={editFirstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Last Name
            </label>
            <input
              type="text"
              value={editLastName}
              onChange={(e) => onLastNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Doe"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Role
          </label>
          <select
            value={editRole}
            onChange={(e) => {
              const newRole = e.target.value as 'registered' | 'owner_admin' | 'super_admin';
              onRoleChange(newRole);
              if (newRole === 'super_admin') {
                onOwnerIdChange(null);
              } else if ((newRole === 'owner_admin' || newRole === 'registered') && !editOwnerId) {
                onOwnerIdChange(owners[0]?.id || null);
              }
            }}
            disabled={isSelfSuperAdmin}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="registered">Registered User</option>
            <option value="owner_admin">Owner Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          {isSelfSuperAdmin && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                You cannot change your own role while you are a super admin. You must remain a super admin.
              </p>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {editRole === 'registered' && 'Basic access to assigned owner groups'}
            {editRole === 'owner_admin' && 'Can manage documents and users for assigned owner group'}
            {editRole === 'super_admin' && 'Full system-wide administrative access'}
          </p>
        </div>

        {(editRole === 'owner_admin' || editRole === 'registered') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Owner Group
            </label>
            <select
              value={editOwnerId || ''}
              onChange={(e) => onOwnerIdChange(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">Select Owner Group</option>
              {owners.map(owner => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {editRole === 'owner_admin' 
                ? 'Select the owner group this user will administer'
                : 'Select the owner group this user will have access to'}
            </p>
          </div>
        )}

        {editRole === 'super_admin' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Super Admins have access to all documents and can manage all users across the system.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <Button
            onClick={onSave}
            disabled={saving || ((editRole === 'owner_admin' || editRole === 'registered') && !editOwnerId)}
            loading={saving}
            className="flex-1"
          >
            Save Changes
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

