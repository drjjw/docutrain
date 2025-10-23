import React, { useState, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { getUsers, updateUserRole, resetUserPassword, updateUserPassword, deleteUser, getOwners } from '@/lib/supabase/admin';
import type { UserWithRoles, Owner } from '@/types/admin';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface EditingCell {
  userId: string;
  field: string;
}

export function UsersTable() {
  const { user } = useAuth();
  const { isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [passwordEditUserId, setPasswordEditUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSuperAdmin, permissionsLoading]);

  const loadData = async () => {
    if (!user?.id || permissionsLoading) {
      setLoading(false);
      return;
    }

    if (!isSuperAdmin) {
      setError('You do not have permission to view users');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [usersData, ownersList] = await Promise.all([
        getUsers(),
        getOwners(),
      ]);
      setUsers(usersData);
      setOwners(ownersList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (userId: string, field: string, currentValue: any) => {
    setEditingCell({ userId, field });
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue(null);
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;

    try {
      setSaving(true);

      if (editingCell.field === 'role') {
        await updateUserRole(editingCell.userId, editValue.role, editValue.owner_id);
      }

      // Update local state
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === editingCell.userId
            ? { ...u, ...editValue }
            : u
        )
      );

      setEditingCell(null);
      setEditValue(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setSaving(true);
      await updateUserPassword(userId, newPassword);
      setPasswordEditUserId(null);
      setNewPassword('');
      setError('Password updated successfully');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (userEmail: string) => {
    try {
      setSaving(true);
      await resetUserPassword(userEmail);
      setResetPasswordConfirm(null);
      setError('Password reset email sent successfully');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      setSaving(true);
      await deleteUser(userId);
      setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  };

  const renderCell = (user: UserWithRoles, field: string, value: any) => {
    const isEditing = editingCell?.userId === user.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          {renderEditInput(field, editValue, setEditValue)}
          <Button
            size="sm"
            onClick={handleSaveEdit}
            disabled={saving}
            loading={saving}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancelEdit}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      );
    }

    const textClass = "truncate";

    return (
      <div
        className="group cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
        onClick={() => handleEdit(user.id, field, value)}
      >
        <div className="flex items-center justify-between">
          <span className={textClass}>{renderDisplayValue(field, value)}</span>
          <svg
            className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </div>
      </div>
    );
  };

  const renderEditInput = (field: string, value: any, onChange: (val: any) => void) => {
    switch (field) {
      case 'role':
        return (
          <div className="flex gap-2">
            <select
              value={value?.role || 'registered'}
              onChange={(e) => onChange({ ...value, role: e.target.value })}
              className="px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="registered">Registered</option>
              <option value="owner_admin">Owner Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            {value?.role === 'owner_admin' && (
              <select
                value={value?.owner_id || ''}
                onChange={(e) => onChange({ ...value, owner_id: e.target.value || null })}
                className="px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Owner</option>
                {owners.map(owner => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        );
    }
  };

  const renderDisplayValue = (field: string, value: any): string => {
    if (value === null || value === undefined) return '—';

    switch (field) {
      case 'email_confirmed_at':
      case 'phone_confirmed_at':
      case 'last_sign_in_at':
      case 'created_at':
      case 'updated_at':
        return value ? new Date(value).toLocaleDateString() : '—';

      case 'is_anonymous':
        return value ? 'Yes' : 'No';

      case 'role':
        // Handle both array format (user.roles) and object format (for editing)
        if (!value) return 'Registered';
        if (Array.isArray(value)) {
          if (value.length === 0) return 'Registered';
          const roles = value.map((r: any) => r.role).join(', ');
          return roles;
        } else if (typeof value === 'object' && value.role) {
          return value.role.replace('_', ' ');
        }
        return 'Registered';

      case 'owner_groups':
        if (!value || value.length === 0) return '—';
        return value.map((og: any) => og.owner_name).join(', ');

      default:
        return String(value);
    }
  };

  const renderRolesCell = (user: UserWithRoles) => {
    const ownerGroups = user.owner_groups || [];
    const primaryRole = ownerGroups.length > 0 ? ownerGroups[0].role : 'registered';
    const ownerName = ownerGroups.length > 0 ? ownerGroups[0].owner_name : '—';

    return (
      <div className="text-sm">
        <div className="font-medium capitalize">{primaryRole.replace('_', ' ')}</div>
        {ownerName !== '—' && <div className="text-gray-500">{ownerName}</div>}
      </div>
    );
  };

  const renderActionsCell = (user: UserWithRoles) => {
    const isEditingPassword = passwordEditUserId === user.id;

    if (isEditingPassword) {
      return (
        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="New password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 flex-1"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => handleUpdatePassword(user.id)}
              disabled={saving || !newPassword || newPassword.length < 6}
              loading={saving}
            >
              Update
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPasswordEditUserId(null);
                setNewPassword('');
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPasswordEditUserId(user.id)}
          disabled={saving}
        >
          Set Password
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setResetPasswordConfirm(user.email)}
          disabled={saving}
        >
          Email Reset Link
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => setDeleteConfirmId(user.id)}
          disabled={saving}
        >
          Delete
        </Button>
      </div>
    );
  };

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant={error.includes('successfully') ? "success" : "error"} onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner Groups
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email Confirmed
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Sign In
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <React.Fragment key={user.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderCell(user, 'role', { role: (user.owner_groups || [])[0]?.role || 'registered', owner_id: (user.owner_groups || [])[0]?.owner_id })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderRolesCell(user)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderDisplayValue('email_confirmed_at', user.email_confirmed_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderDisplayValue('last_sign_in_at', user.last_sign_in_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {renderDisplayValue('created_at', user.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {renderActionsCell(user)}
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No users found
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {resetPasswordConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Email Reset Link</h3>
            <p className="text-sm text-gray-600 mb-6">
              Send password reset email to <strong>{resetPasswordConfirm}</strong>?
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => handleResetPassword(resetPasswordConfirm)}
                disabled={saving}
                loading={saving}
              >
                Send Email
              </Button>
              <Button
                variant="outline"
                onClick={() => setResetPasswordConfirm(null)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete User</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={saving}
                loading={saving}
              >
                Delete User
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmId(null)}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
