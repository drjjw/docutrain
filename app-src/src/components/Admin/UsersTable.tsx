import { useState, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { Modal } from '@/components/UI/Modal';
import { getUsers, updateUserRole, resetUserPassword, updateUserPassword, deleteUser, banUser, unbanUser, getUserStatistics, getOwners, getUserProfileAsAdmin, updateUserProfileAsAdmin, inviteUser } from '@/lib/supabase/admin';
import type { UserWithRoles, Owner, UserStatistics } from '@/types/admin';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface EditingPermissions {
  userId: string;
  userEmail: string;
  role: 'registered' | 'owner_admin' | 'super_admin';
  owner_id: string | null;
  firstName?: string;
  lastName?: string;
}

export function UsersTable() {
  const { user } = useAuth();
  const { isSuperAdmin, isOwnerAdmin, loading: permissionsLoading, ownerGroups } = usePermissions();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [passwordEditUserId, setPasswordEditUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editingPermissions, setEditingPermissions] = useState<EditingPermissions | null>(null);
  const [editRole, setEditRole] = useState<'registered' | 'owner_admin' | 'super_admin'>('registered');
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkEditPermissions, setBulkEditPermissions] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkRole, setBulkRole] = useState<'registered' | 'owner_admin' | 'super_admin'>('registered');
  const [bulkOwnerId, setBulkOwnerId] = useState<string | null>(null);
  const [viewingStatsUserId, setViewingStatsUserId] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<UserStatistics | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [deleteAction, setDeleteAction] = useState<'delete' | 'ban'>('delete');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteOwnerId, setInviteOwnerId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSuperAdmin, permissionsLoading]);

  // Auto-set owner_id for owner admins when invite modal opens
  useEffect(() => {
    if (showInviteModal && !isSuperAdmin && isOwnerAdmin && ownerGroups.length > 0) {
      const adminOwnerGroups = ownerGroups.filter(og => og.role === 'owner_admin' && og.owner_id);
      if (adminOwnerGroups.length > 0 && inviteOwnerId !== adminOwnerGroups[0].owner_id) {
        setInviteOwnerId(adminOwnerGroups[0].owner_id || null);
      }
    }
  }, [showInviteModal, isSuperAdmin, isOwnerAdmin, ownerGroups, inviteOwnerId]);

  const loadData = async () => {
    if (!user?.id || permissionsLoading) {
      setLoading(false);
      return;
    }

    // Allow both super admins and owner admins
    const hasAdminAccess = isSuperAdmin || isOwnerAdmin;
    if (!hasAdminAccess) {
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

  const openEditPermissions = async (user: UserWithRoles) => {
    const ownerGroups = user.owner_groups || [];
    
    // Prioritize Maker Pizza if it exists
    const makerPizza = ownerGroups.find(og => 
      og.owner_name === 'Maker Pizza' || og.owner_slug === 'maker'
    );
    
    const ownerAdminRole = makerPizza || ownerGroups.find(og => 
      og.role === 'owner_admin' && og.owner_id
    );

    const hasSuperAdmin = user.roles?.some(r => r.role === 'super_admin') || 
                         ownerGroups.some(og => og.role === 'super_admin');

    let initialRole: 'registered' | 'owner_admin' | 'super_admin' = 'registered';
    let initialOwnerId: string | null = null;

    if (hasSuperAdmin) {
      initialRole = 'super_admin';
      initialOwnerId = null;
    } else if (ownerAdminRole) {
      initialRole = 'owner_admin';
      initialOwnerId = ownerAdminRole.owner_id || null;
    }

    // Fetch user profile data
    let firstName = '';
    let lastName = '';
    try {
      const profile = await getUserProfileAsAdmin(user.id);
      if (profile) {
        firstName = profile.first_name || '';
        lastName = profile.last_name || '';
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }

    setEditingPermissions({
      userId: user.id,
      userEmail: user.email,
      role: initialRole,
      owner_id: initialOwnerId,
      firstName,
      lastName,
    });
    setEditRole(initialRole);
    setEditOwnerId(initialOwnerId);
    setEditEmail(user.email);
    setEditFirstName(firstName);
    setEditLastName(lastName);
  };

  const handleSavePermissions = async () => {
    if (!editingPermissions) return;

    try {
      setSaving(true);
      setError(null);
      
      // Check if user is trying to downgrade themselves from super_admin
      const editingUser = users.find(u => u.id === editingPermissions.userId);
      const isEditingSelf = user?.id === editingPermissions.userId;
      const currentHasSuperAdmin = editingUser?.roles?.some(r => r.role === 'super_admin') || 
                                   editingUser?.owner_groups?.some(og => og.role === 'super_admin');
      
      if (isEditingSelf && currentHasSuperAdmin && editRole !== 'super_admin') {
        setError('Super admins cannot downgrade their own role');
        setSaving(false);
        return;
      }
      
      // Update role and permissions (only if role changed or owner changed)
      const roleChanged = editRole !== editingPermissions.role || editOwnerId !== editingPermissions.owner_id;
      if (roleChanged) {
        await updateUserRole(editingPermissions.userId, editRole, editOwnerId || undefined);
      }
      
      // Update user profile (email, first_name, last_name) if changed
      const profileUpdates: {
        email?: string;
        first_name?: string;
        last_name?: string;
      } = {};
      
      if (editEmail !== editingPermissions.userEmail) {
        profileUpdates.email = editEmail;
      }
      if (editFirstName !== (editingPermissions.firstName || '')) {
        profileUpdates.first_name = editFirstName || undefined;
      }
      if (editLastName !== (editingPermissions.lastName || '')) {
        profileUpdates.last_name = editLastName || undefined;
      }
      
      if (Object.keys(profileUpdates).length > 0) {
        await updateUserProfileAsAdmin(editingPermissions.userId, profileUpdates);
      }
      
      await loadData();
      
      setEditingPermissions(null);
      setEditRole('registered');
      setEditOwnerId(null);
      setEditEmail('');
      setEditFirstName('');
      setEditLastName('');
      
      setError('User updated successfully');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save changes';
      console.error('Error updating user:', err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEditPermissions = () => {
    setEditingPermissions(null);
    setEditRole('registered');
    setEditOwnerId(null);
    setEditEmail('');
    setEditFirstName('');
    setEditLastName('');
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
      if (deleteAction === 'ban') {
        await banUser(userId, 'permanent');
        setError('User banned successfully');
      } else {
        await deleteUser(userId);
        setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
      }
      setDeleteConfirmId(null);
      setDeleteAction('delete');
      await loadData(); // Reload to show updated ban status
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process user action');
    } finally {
      setSaving(false);
    }
  };

  const handleViewStats = async (userId: string) => {
    try {
      setLoadingStats(true);
      setViewingStatsUserId(userId);
      const stats = await getUserStatistics(userId);
      setUserStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user statistics');
      setViewingStatsUserId(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      setSaving(true);
      await unbanUser(userId);
      await loadData();
      setError('User unbanned successfully');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unban user');
    } finally {
      setSaving(false);
    }
  };

  const userNeedsApproval = (user: UserWithRoles): boolean => {
    const hasRoles = user.roles && user.roles.length > 0;
    const hasOwnerGroups = user.owner_groups && user.owner_groups.length > 0;
    return !hasRoles && !hasOwnerGroups;
  };

  const isProtectedSuperAdmin = (user: UserWithRoles): boolean => {
    const hasSuperAdmin = user.roles?.some(r => r.role === 'super_admin') || 
                         (user.owner_groups || []).some(og => og.role === 'super_admin');
    return user.email === 'drjweinstein@gmail.com' && hasSuperAdmin;
  };

  const getRoleBadge = (user: UserWithRoles, isSuperAdmin: boolean) => {
    const ownerGroups = user.owner_groups || [];
    const hasSuperAdmin = user.roles?.some(r => r.role === 'super_admin') || 
                         ownerGroups.some(og => og.role === 'super_admin');

    if (hasSuperAdmin) {
      return {
        label: 'Super Admin',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        description: 'Global Access',
      };
    }

    if (ownerGroups.length > 0) {
      const makerPizza = ownerGroups.find(og => 
        og.owner_name === 'Maker Pizza' || og.owner_slug === 'maker'
      );
      const primaryGroup = makerPizza || ownerGroups[0];
      
      const roleLabel = primaryGroup.role === 'owner_admin' ? 'Owner Admin' : 'Registered';
      const ownerName = primaryGroup.owner_name || 'Unknown';
      
      return {
        label: roleLabel,
        color: primaryGroup.role === 'owner_admin' 
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : 'bg-gray-100 text-gray-800 border-gray-200',
        description: isSuperAdmin ? ownerName : undefined, // Only show owner name for super admins
      };
    }

    return {
      label: 'Registered',
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      description: isSuperAdmin ? 'No owner group' : undefined, // Only show description for super admins
    };
  };

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const selectableUsers = users.filter(u => !isProtectedSuperAdmin(u));
    const allSelected = selectableUsers.every(u => selectedUserIds.has(u.id));
    
    if (allSelected) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(selectableUsers.map(u => u.id)));
    }
  };

  const getSelectableUsers = () => {
    return users.filter(u => !isProtectedSuperAdmin(u));
  };

  const selectedCount = selectedUserIds.size;
  const selectableCount = getSelectableUsers().length;
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;
  const someSelected = selectedCount > 0 && selectedCount < selectableCount;

  const handleBulkRoleAssignment = async () => {
    if (selectedUserIds.size === 0) return;

    try {
      setSaving(true);
      setError(null);

      const userIds = Array.from(selectedUserIds);
      const results = await Promise.allSettled(
        userIds.map(userId => 
          updateUserRole(userId, bulkRole, bulkOwnerId || undefined)
        )
      );

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        const errorMessages = failures
          .map((r: PromiseRejectedResult) => r.reason?.message || 'Unknown error')
          .join(', ');
        setError(`Failed to update ${failures.length} user(s): ${errorMessages}`);
      } else {
        setError(`Successfully updated ${userIds.length} user(s)`);
        setTimeout(() => setError(null), 3000);
      }

      await loadData();
      setSelectedUserIds(new Set());
      setBulkEditPermissions(false);
      setBulkRole('registered');
      setBulkOwnerId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update users');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedUserIds.size === 0) return;

    try {
      setSaving(true);
      setError(null);

      const userIds = Array.from(selectedUserIds);
      const results = await Promise.allSettled(
        userIds.map(userId => deleteUser(userId))
      );

      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        const errorMessages = failures
          .map((r: PromiseRejectedResult) => r.reason?.message || 'Unknown error')
          .join(', ');
        setError(`Failed to delete ${failures.length} user(s): ${errorMessages}`);
      } else {
        setError(`Successfully deleted ${userIds.length} user(s)`);
        setTimeout(() => setError(null), 3000);
      }

      await loadData();
      setSelectedUserIds(new Set());
      setBulkDeleteConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete users');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteEmail || (!isSuperAdmin && !inviteOwnerId)) {
      setError('Please fill in all fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // For owner admins, ensure owner_id is set from their owner group
    let ownerIdToUse = inviteOwnerId;
    if (!isSuperAdmin && isOwnerAdmin && !ownerIdToUse) {
      const adminOwnerGroups = ownerGroups.filter(og => og.role === 'owner_admin' && og.owner_id);
      if (adminOwnerGroups.length > 0) {
        ownerIdToUse = adminOwnerGroups[0].owner_id || null;
      }
    }

    if (!ownerIdToUse) {
      setError('Please select an owner group');
      return;
    }

    try {
      setInviting(true);
      setError(null);
      
      console.log('Inviting user:', { email: inviteEmail, owner_id: ownerIdToUse, isSuperAdmin, isOwnerAdmin });
      
      const result = await inviteUser(inviteEmail, ownerIdToUse);
      
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteOwnerId(null);
      
      setError(result.message || 'Invitation sent successfully');
      setTimeout(() => setError(null), 5000);
      
      // Reload users to show newly added user if they existed
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation';
      console.error('Error inviting user:', err);
      setError(errorMessage);
    } finally {
      setInviting(false);
    }
  };

  if (loading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert 
          variant={error.includes('successfully') || error.includes('added to') || error.includes('sent') ? "success" : "error"} 
          onDismiss={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Header with Invite Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage users and their access to owner groups
          </p>
        </div>
        {(isSuperAdmin || isOwnerAdmin) && (
          <Button
            onClick={() => {
              setShowInviteModal(true);
              setInviteEmail('');
              // For owner admins, automatically set their owner group
              if (!isSuperAdmin && isOwnerAdmin && ownerGroups.length > 0) {
                const adminOwnerGroups = ownerGroups.filter(og => og.role === 'owner_admin' && og.owner_id);
                if (adminOwnerGroups.length > 0) {
                  // Set the owner ID from the ownerGroups (which has owner_id)
                  setInviteOwnerId(adminOwnerGroups[0].owner_id || null);
                } else {
                  setInviteOwnerId(null);
                }
              } else {
                // Super admins start with no selection
                setInviteOwnerId(null);
              }
            }}
            disabled={saving}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite User
          </Button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedCount} user{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBulkEditPermissions(true);
                  setBulkRole('registered');
                  setBulkOwnerId(null);
                }}
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
                onClick={() => setBulkDeleteConfirm(true)}
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
              onClick={() => setSelectedUserIds(new Set())}
              disabled={saving}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Role & Permissions
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Last Sign In
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => {
                const needsApproval = userNeedsApproval(user);
                const isProtected = isProtectedSuperAdmin(user);
                const roleBadge = getRoleBadge(user, isSuperAdmin);
                
                const isSelected = selectedUserIds.has(user.id);
                const canSelect = !isProtected;

                // Get display name: use first_name + last_name if available, otherwise use email
                const displayName = (user.first_name || user.last_name)
                  ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                  : user.email;
                
                // Get initial for avatar: use first letter of display name
                const avatarInitial = displayName.charAt(0).toUpperCase();

                return (
                  <tr 
                    key={user.id} 
                    className={`hover:bg-gray-50 transition-colors ${
                      needsApproval ? 'bg-amber-50/50' : ''
                    } ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {canSelect && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleUserSelection(user.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                          {avatarInitial}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {displayName}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {needsApproval && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                                Pending Approval
                              </span>
                            )}
                            {isProtected && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                                Protected
                              </span>
                            )}
                            {user.email_confirmed_at && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                Verified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${roleBadge.color}`}>
                            {roleBadge.label}
                          </div>
                          {roleBadge.description && roleBadge.description !== 'Global Access' && (
                            <div className="text-xs text-gray-500 mt-1">
                              {roleBadge.description}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditPermissions(user)}
                          className="flex-shrink-0"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </Button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.email_confirmed_at ? (
                        <span className="inline-flex items-center">
                          <svg className="w-4 h-4 text-green-500 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Email Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-600">
                          <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.last_sign_in_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewStats(user.id)}
                          disabled={saving}
                          title="View user statistics"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          Stats
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setResetPasswordConfirm(user.email)}
                          disabled={saving}
                          title="Send password reset email"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPasswordEditUserId(user.id)}
                          disabled={saving}
                          title="Set password directly"
                        >
                          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Password
                        </Button>
                        {user.banned_until && new Date(user.banned_until) > new Date() ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnban(user.id)}
                            disabled={saving || isProtected}
                            title="Unban user"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Unban
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setDeleteConfirmId(user.id);
                              setDeleteAction('delete');
                            }}
                            disabled={saving || isProtected}
                            title={isProtected ? 'Protected super admin cannot be deleted' : 'Delete or ban user'}
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-4">
              {users.map((user) => {
                const needsApproval = userNeedsApproval(user);
                const isProtected = isProtectedSuperAdmin(user);
                const roleBadge = getRoleBadge(user, isSuperAdmin);
                const isSelected = selectedUserIds.has(user.id);
                const canSelect = !isProtected;
                
                // Get display name: use first_name + last_name if available, otherwise use email
                const displayName = (user.first_name || user.last_name)
                  ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                  : user.email;
                
                // Get initial for avatar: use first letter of display name
                const avatarInitial = displayName.charAt(0).toUpperCase();
                
                return (
            <div 
              key={user.id} 
              className={`bg-white rounded-lg shadow-sm border ${
                needsApproval ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'
              } overflow-hidden`}
            >
              {/* Card Header */}
              <div className={`px-4 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 ${isSelected ? 'bg-blue-50' : ''}`}>
                <div className="flex items-center gap-3">
                  {canSelect && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUserSelection(user.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
                    />
                  )}
                  <div className="flex-shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                    {avatarInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{displayName}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {needsApproval && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                          Pending Approval
                        </span>
                      )}
                      {isProtected && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Protected
                        </span>
                      )}
                      {user.email_confirmed_at && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="px-4 py-4 space-y-4">
                {/* Role Section */}
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Role & Permissions
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border ${roleBadge.color}`}>
                        {roleBadge.label}
                      </div>
                      {roleBadge.description && roleBadge.description !== 'Global Access' && (
                        <div className="text-xs text-gray-500 mt-1">
                          {roleBadge.description}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditPermissions(user)}
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </Button>
                  </div>
                </div>

                {/* Dates Grid */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Last Sign In</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatDate(user.last_sign_in_at)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Created</div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatDate(user.created_at)}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResetPasswordConfirm(user.email)}
                      disabled={saving}
                      className="flex-1 min-w-[120px]"
                      title="Send password reset email"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Reset Link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPasswordEditUserId(user.id)}
                      disabled={saving}
                      className="flex-1 min-w-[120px]"
                      title="Set password directly"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Set Password
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteConfirmId(user.id)}
                      disabled={saving || isProtected}
                      className="flex-1 min-w-[120px]"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {users.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new user.</p>
        </div>
      )}

      {/* Edit Permissions Modal */}
      <Modal
        isOpen={!!editingPermissions}
        onClose={handleCancelEditPermissions}
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
              onChange={(e) => setEditEmail(e.target.value)}
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
                onChange={(e) => setEditFirstName(e.target.value)}
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
                onChange={(e) => setEditLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            {(() => {
              const isEditingSelf = user?.id === editingPermissions?.userId;
              const currentHasSuperAdmin = editingPermissions?.role === 'super_admin';
              const isSelfSuperAdmin = isEditingSelf && currentHasSuperAdmin;
              
              return (
                <>
                  <select
                    value={editRole}
                    onChange={(e) => {
                      const newRole = e.target.value as 'registered' | 'owner_admin' | 'super_admin';
                      setEditRole(newRole);
                      if (newRole === 'super_admin') {
                        setEditOwnerId(null);
                      } else if ((newRole === 'owner_admin' || newRole === 'registered') && !editOwnerId) {
                        // Keep current owner_id or set to first owner for owner_admin or registered
                        setEditOwnerId(owners[0]?.id || null);
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
                </>
              );
            })()}
          </div>

          {(editRole === 'owner_admin' || editRole === 'registered') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Owner Group
              </label>
              <select
                value={editOwnerId || ''}
                onChange={(e) => setEditOwnerId(e.target.value || null)}
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
              onClick={handleSavePermissions}
              disabled={saving || ((editRole === 'owner_admin' || editRole === 'registered') && !editOwnerId)}
              loading={saving}
              className="flex-1"
            >
              Save Changes
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelEditPermissions}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Set Password Modal */}
      {passwordEditUserId && (
        <Modal
          isOpen={!!passwordEditUserId}
          onClose={() => {
            setPasswordEditUserId(null);
            setNewPassword('');
          }}
          title="Set User Password"
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                placeholder="Enter new password (min 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 6 characters long
              </p>
            </div>
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                onClick={() => handleUpdatePassword(passwordEditUserId)}
                disabled={saving || !newPassword || newPassword.length < 6}
                loading={saving}
                className="flex-1"
              >
                Update Password
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPasswordEditUserId(null);
                  setNewPassword('');
                }}
                disabled={saving}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset Password Confirmation Modal */}
      {resetPasswordConfirm && (
        <Modal
          isOpen={!!resetPasswordConfirm}
          onClose={() => setResetPasswordConfirm(null)}
          title="Send Password Reset Email"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Send a password reset email to <strong className="font-medium">{resetPasswordConfirm}</strong>?
            </p>
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                onClick={() => handleResetPassword(resetPasswordConfirm)}
                disabled={saving}
                loading={saving}
                className="flex-1"
              >
                Send Email
              </Button>
              <Button
                variant="outline"
                onClick={() => setResetPasswordConfirm(null)}
                disabled={saving}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete/Ban Confirmation Modal */}
      {deleteConfirmId && (
        <Modal
          isOpen={!!deleteConfirmId}
          onClose={() => {
            setDeleteConfirmId(null);
            setDeleteAction('delete');
          }}
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
                onChange={(e) => setDeleteAction(e.target.value as 'delete' | 'ban')}
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
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={saving}
                loading={saving}
                className="flex-1"
              >
                {deleteAction === 'ban' ? 'Ban User' : 'Delete User'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteAction('delete');
                }}
                disabled={saving}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* User Statistics Modal */}
      {viewingStatsUserId && (
        <Modal
          isOpen={!!viewingStatsUserId}
          onClose={() => {
            setViewingStatsUserId(null);
            setUserStats(null);
          }}
          title="User Statistics"
          size="lg"
        >
          <div className="space-y-6">
            {loadingStats ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : userStats ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-blue-700">Documents Uploaded</div>
                    <div className="text-2xl font-bold text-blue-900 mt-1">{userStats.document_count}</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-green-700">Account Status</div>
                    <div className="text-lg font-semibold text-green-900 mt-1">
                      {userStats.is_banned ? 'Banned' : userStats.email_verified ? 'Active' : 'Unverified'}
                    </div>
                  </div>
                </div>

                {userStats.documents && userStats.documents.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Uploaded Documents</h4>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {userStats.documents.map((doc, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-900">{doc.title}</td>
                              <td className="px-4 py-2 text-sm text-gray-600 font-mono">{doc.slug}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">
                                {new Date(doc.uploaded_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Last Login</div>
                    <div className="text-sm font-medium text-gray-900">
                      {userStats.last_login ? new Date(userStats.last_login).toLocaleString() : 'Never'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Account Created</div>
                    <div className="text-sm font-medium text-gray-900">
                      {userStats.account_created ? new Date(userStats.account_created).toLocaleString() : 'Unknown'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Failed to load statistics
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => {
                  setViewingStatsUserId(null);
                  setUserStats(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Edit Permissions Modal */}
      <Modal
        isOpen={bulkEditPermissions}
        onClose={() => {
          setBulkEditPermissions(false);
          setBulkRole('registered');
          setBulkOwnerId(null);
        }}
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
                setBulkRole(newRole);
                if (newRole === 'super_admin') {
                  setBulkOwnerId(null);
                } else if ((newRole === 'owner_admin' || newRole === 'registered') && !bulkOwnerId) {
                  setBulkOwnerId(owners[0]?.id || null);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                onChange={(e) => setBulkOwnerId(e.target.value || null)}
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
                {bulkRole === 'owner_admin'
                  ? 'Select the owner group these users will administer'
                  : 'Select the owner group these users will have access to'}
              </p>
            </div>
          )}

          {bulkRole === 'super_admin' && (
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
              onClick={handleBulkRoleAssignment}
              disabled={saving || ((bulkRole === 'owner_admin' || bulkRole === 'registered') && !bulkOwnerId)}
              loading={saving}
              className="flex-1"
            >
              Assign to {selectedCount} User{selectedCount !== 1 ? 's' : ''}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setBulkEditPermissions(false);
                setBulkRole('registered');
                setBulkOwnerId(null);
              }}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        title="Delete Multiple Users"
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
                  This will permanently delete {selectedCount} user{selectedCount !== 1 ? 's' : ''} and all associated data.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
            <div className="text-xs font-medium text-gray-700 mb-2">Users to be deleted:</div>
            <div className="space-y-1">
              {Array.from(selectedUserIds).map(userId => {
                const user = users.find(u => u.id === userId);
                return user ? (
                  <div key={userId} className="text-sm text-gray-600">
                    • {user.email}
                  </div>
                ) : null;
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              variant="danger"
              onClick={handleBulkDelete}
              disabled={saving}
              loading={saving}
              className="flex-1"
            >
              Delete {selectedCount} User{selectedCount !== 1 ? 's' : ''}
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteConfirm(false)}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
      {/* Invite User Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteEmail('');
          setInviteOwnerId(null);
        }}
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
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                onChange={(e) => setInviteOwnerId(e.target.value || null)}
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>New users:</strong> Will receive an invitation email with a signup link. They'll be automatically verified and added to the selected owner group.
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  <strong>Existing users:</strong> Will be automatically added to the owner group and receive a notification email.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              onClick={handleInviteUser}
              disabled={inviting || !inviteEmail || (isSuperAdmin && !inviteOwnerId)}
              loading={inviting}
              className="flex-1"
            >
              Send Invitation
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteOwnerId(null);
              }}
              disabled={inviting}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
