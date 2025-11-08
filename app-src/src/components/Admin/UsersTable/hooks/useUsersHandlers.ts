import type { UserWithRoles, Owner } from '@/types/admin';
import type { EditingPermissions } from '../types';
import { 
  updateUserRole, 
  resetUserPassword, 
  updateUserPassword, 
  deleteUser, 
  banUser, 
  unbanUser, 
  getUserStatistics, 
  getUserProfileAsAdmin, 
  updateUserProfileAsAdmin, 
  inviteUser, 
  deletePendingInvitation, 
  resendPendingInvitation 
} from '@/lib/supabase/admin';

interface UseUsersHandlersParams {
  users: UserWithRoles[];
  owners: Owner[];
  selectedUserIds: Set<string>;
  editingPermissions: EditingPermissions | null;
  editRole: 'registered' | 'owner_admin' | 'super_admin';
  editOwnerId: string | null;
  editEmail: string;
  editFirstName: string;
  editLastName: string;
  newPassword: string;
  deleteAction: 'delete' | 'ban';
  bulkRole: 'registered' | 'owner_admin' | 'super_admin';
  bulkOwnerId: string | null;
  inviteEmail: string;
  inviteOwnerId: string | null;
  isSuperAdmin: boolean;
  isOwnerAdmin: boolean;
  ownerGroups: Array<{ role: string; owner_id: string | null }>;
  currentUserId: string | undefined;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setEditingPermissions: (permissions: EditingPermissions | null) => void;
  setEditRole: (role: 'registered' | 'owner_admin' | 'super_admin') => void;
  setEditOwnerId: (id: string | null) => void;
  setEditEmail: (email: string) => void;
  setEditFirstName: (name: string) => void;
  setEditLastName: (name: string) => void;
  setPasswordEditUserId: (id: string | null) => void;
  setNewPassword: (password: string) => void;
  setResetPasswordConfirm: (email: string | null) => void;
  setDeleteConfirmId: (id: string | null) => void;
  setDeleteAction: (action: 'delete' | 'ban') => void;
  setViewingStatsUserId: (id: string | null) => void;
  setUserStats: (stats: any) => void;
  setLoadingStats: (loading: boolean) => void;
  setSelectedUserIds: (ids: Set<string>) => void;
  setBulkEditPermissions: (show: boolean) => void;
  setBulkRole: (role: 'registered' | 'owner_admin' | 'super_admin') => void;
  setBulkOwnerId: (id: string | null) => void;
  setBulkDeleteConfirm: (show: boolean) => void;
  setShowInviteModal: (show: boolean) => void;
  setInviteEmail: (email: string) => void;
  setInviteOwnerId: (id: string | null) => void;
  setInviting: (inviting: boolean) => void;
  setResendingInvitationId: (id: string | null) => void;
  setDeletingInvitationId: (id: string | null) => void;
  setUsers: (users: UserWithRoles[] | ((prev: UserWithRoles[]) => UserWithRoles[])) => void;
  loadData: () => Promise<void>;
}

export function useUsersHandlers(params: UseUsersHandlersParams) {
  const {
    users,
    owners,
    selectedUserIds,
    editingPermissions,
    editRole,
    editOwnerId,
    editEmail,
    editFirstName,
    editLastName,
    newPassword,
    deleteAction,
    bulkRole,
    bulkOwnerId,
    inviteEmail,
    inviteOwnerId,
    isSuperAdmin,
    isOwnerAdmin,
    ownerGroups,
    currentUserId,
    setSaving,
    setError,
    setEditingPermissions,
    setEditRole,
    setEditOwnerId,
    setEditEmail,
    setEditFirstName,
    setEditLastName,
    setPasswordEditUserId,
    setNewPassword,
    setResetPasswordConfirm,
    setDeleteConfirmId,
    setDeleteAction,
    setViewingStatsUserId,
    setUserStats,
    setLoadingStats,
    setSelectedUserIds,
    setBulkEditPermissions,
    setBulkRole,
    setBulkOwnerId,
    setBulkDeleteConfirm,
    setShowInviteModal,
    setInviteEmail,
    setInviteOwnerId,
    setInviting,
    setResendingInvitationId,
    setDeletingInvitationId,
    setUsers,
    loadData,
  } = params;

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
      const isEditingSelf = currentUserId === editingPermissions.userId;
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

  const handleDeleteInvitation = async (invitationId: string) => {
    try {
      setSaving(true);
      setError(null);
      await deletePendingInvitation(invitationId);
      await loadData(); // Reload to refresh the list
      setDeletingInvitationId(null);
      setError('Invitation deleted successfully');
      setTimeout(() => setError(null), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete invitation';
      console.error('Error deleting invitation:', err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    try {
      setSaving(true);
      setError(null);
      const result = await resendPendingInvitation(invitationId);
      await loadData(); // Reload to refresh the list
      setResendingInvitationId(null);
      setError(result.message || 'Invitation resent successfully');
      setTimeout(() => setError(null), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend invitation';
      console.error('Error resending invitation:', err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  return {
    openEditPermissions,
    handleSavePermissions,
    handleCancelEditPermissions,
    handleUpdatePassword,
    handleResetPassword,
    handleDelete,
    handleViewStats,
    handleUnban,
    handleBulkRoleAssignment,
    handleBulkDelete,
    handleInviteUser,
    handleDeleteInvitation,
    handleResendInvitation,
  };
}


