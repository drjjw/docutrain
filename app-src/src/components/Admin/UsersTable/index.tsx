import { useState, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsersData } from './hooks/useUsersData';
import { useUsersFiltering } from './hooks/useUsersFiltering';
import { useUsersSelection } from './hooks/useUsersSelection';
import { useUsersHandlers } from './hooks/useUsersHandlers';
import { BulkActionsBar } from './components/BulkActionsBar';
import { UserFilters } from './components/UserFilters';
import { UsersTableRow } from './components/UsersTableRow';
import { UsersTableCard } from './components/UsersTableCard';
import { InvitationRow } from './components/InvitationRow';
import { InvitationCard } from './components/InvitationCard';
import { EditPermissionsModal } from './modals/EditPermissionsModal';
import { SetPasswordModal } from './modals/SetPasswordModal';
import { ResetPasswordModal } from './modals/ResetPasswordModal';
import { DeleteUserModal } from './modals/DeleteUserModal';
import { UserStatsModal } from './modals/UserStatsModal';
import { BulkEditPermissionsModal } from './modals/BulkEditPermissionsModal';
import { BulkDeleteModal } from './modals/BulkDeleteModal';
import { InviteUserModal } from './modals/InviteUserModal';
import { DeleteInvitationModal } from './modals/DeleteInvitationModal';
import type { UserStatistics } from '@/types/admin';
import type { EditingPermissions } from './types';

export function UsersTable() {
  const { user } = useAuth();
  const { isSuperAdmin, isOwnerAdmin, loading: permissionsLoading, ownerGroups } = usePermissions();
  
  // Data management
  const {
    users,
    setUsers,
    pendingInvitations,
    owners,
    loading,
    error,
    setError,
    loadData,
  } = useUsersData();

  // Filtering
  const {
    filteredUsers,
    filteredInvitations,
    filteredMergedItems,
    searchQuery,
    roleFilter,
    statusFilter,
    typeFilter,
    ownerFilter,
    setSearchQuery,
    setRoleFilter,
    setStatusFilter,
    setTypeFilter,
    setOwnerFilter,
    clearAllFilters,
  } = useUsersFiltering({
    users,
    pendingInvitations,
    isSuperAdmin,
  });

  // Selection management (use filtered items)
  const {
    selectedUserIds,
    selectedInvitationIds,
    setSelectedUserIds,
    setSelectedInvitationIds,
    toggleUserSelection,
    toggleInvitationSelection,
    toggleSelection,
    toggleSelectAll,
    selectedCount,
    allSelected,
    someSelected,
  } = useUsersSelection(filteredUsers, filteredInvitations);

  // Modal state
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
  const [inviteRole, setInviteRole] = useState<'registered' | 'owner_admin'>('registered');
  const [inviting, setInviting] = useState(false);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [deletingInvitationId, setDeletingInvitationId] = useState<string | null>(null);

  // Auto-set owner_id for owner admins when invite modal opens
  useEffect(() => {
    if (showInviteModal && !isSuperAdmin && isOwnerAdmin && ownerGroups.length > 0) {
      const adminOwnerGroups = ownerGroups.filter(og => og.role === 'owner_admin' && og.owner_id);
      if (adminOwnerGroups.length > 0 && inviteOwnerId !== adminOwnerGroups[0].owner_id) {
        setInviteOwnerId(adminOwnerGroups[0].owner_id || null);
      }
      // Owner admins can only create registered users
      setInviteRole('registered');
    } else if (showInviteModal && isSuperAdmin) {
      // Reset role when super admin opens modal
      setInviteRole('registered');
    }
  }, [showInviteModal, isSuperAdmin, isOwnerAdmin, ownerGroups, inviteOwnerId]);

  // Handlers
  const handlers = useUsersHandlers({
    users,
    pendingInvitations,
    owners,
    selectedUserIds,
    selectedInvitationIds,
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
    inviteRole,
    isSuperAdmin,
    isOwnerAdmin,
    ownerGroups,
    currentUserId: user?.id,
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
    setSelectedInvitationIds,
    setBulkEditPermissions,
    setBulkRole,
    setBulkOwnerId,
    setBulkDeleteConfirm,
    setShowInviteModal,
    setInviteEmail,
    setInviteOwnerId,
    setInviteRole,
    setInviting,
    setResendingInvitationId,
    setDeletingInvitationId,
    setUsers,
    loadData,
  });

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
              setInviteRole('registered');
              // For owner admins, automatically set their owner group
              if (!isSuperAdmin && isOwnerAdmin && ownerGroups.length > 0) {
                const adminOwnerGroups = ownerGroups.filter(og => og.role === 'owner_admin' && og.owner_id);
                if (adminOwnerGroups.length > 0) {
                  setInviteOwnerId(adminOwnerGroups[0].owner_id || null);
                } else {
                  setInviteOwnerId(null);
                }
              } else {
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

      {/* Search and Filters */}
      <UserFilters
        searchQuery={searchQuery}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        ownerFilter={ownerFilter}
        owners={owners}
        isSuperAdmin={isSuperAdmin}
        totalUsers={users.length}
        totalInvitations={pendingInvitations.length}
        filteredUsers={filteredUsers.length}
        filteredInvitations={filteredInvitations.length}
        onSearchChange={setSearchQuery}
        onRoleFilterChange={setRoleFilter}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
        onOwnerFilterChange={setOwnerFilter}
        onClearFilters={clearAllFilters}
      />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedCount}
        saving={saving}
        onAssignRole={() => {
          setBulkEditPermissions(true);
          setBulkRole('registered');
          setBulkOwnerId(null);
        }}
        onDeleteSelected={() => setBulkDeleteConfirm(true)}
        onClearSelection={() => {
          setSelectedUserIds(new Set());
          setSelectedInvitationIds(new Set());
        }}
      />

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
                    className="w-4 h-4 text-docutrain-light border-gray-300 rounded focus:ring-docutrain-light"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Role & Permissions
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Owner
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
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMergedItems.map((item) => {
                if (item.type === 'user') {
                  return (
                    <UsersTableRow
                      key={item.id}
                      user={item.data}
                      isSuperAdmin={isSuperAdmin}
                      selectedUserIds={selectedUserIds}
                      saving={saving}
                      resendingInvitationId={resendingInvitationId}
                      deletingInvitationId={deletingInvitationId}
                      onToggleSelection={toggleUserSelection}
                      onEditPermissions={handlers.openEditPermissions}
                      onViewStats={handlers.handleViewStats}
                      onResetPassword={(email) => setResetPasswordConfirm(email)}
                      onSetPassword={(userId) => setPasswordEditUserId(userId)}
                      onUnban={handlers.handleUnban}
                      onDelete={(userId) => {
                        setDeleteConfirmId(userId);
                        setDeleteAction('delete');
                      }}
                    />
                  );
                } else {
                  return (
                    <InvitationRow
                      key={`invitation-${item.id}`}
                      invitation={item.data}
                      selectedInvitationIds={selectedInvitationIds}
                      saving={saving}
                      resendingInvitationId={resendingInvitationId}
                      deletingInvitationId={deletingInvitationId}
                      onToggleSelection={toggleInvitationSelection}
                      onResend={handlers.handleResendInvitation}
                      onDelete={(id) => setDeletingInvitationId(id)}
                    />
                  );
                }
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/Tablet Card View */}
      <div className="lg:hidden space-y-4">
        {filteredMergedItems.map((item) => {
          if (item.type === 'user') {
            return (
              <UsersTableCard
                key={item.id}
                user={item.data}
                isSuperAdmin={isSuperAdmin}
                selectedUserIds={selectedUserIds}
                saving={saving}
                onToggleSelection={toggleUserSelection}
                onEditPermissions={handlers.openEditPermissions}
                onViewStats={handlers.handleViewStats}
                onResetPassword={(email) => setResetPasswordConfirm(email)}
                onSetPassword={(userId) => setPasswordEditUserId(userId)}
                onUnban={handlers.handleUnban}
                onDelete={(userId) => {
                  setDeleteConfirmId(userId);
                  setDeleteAction('delete');
                }}
              />
            );
          } else {
            return (
              <InvitationCard
                key={`invitation-${item.id}`}
                invitation={item.data}
                selectedInvitationIds={selectedInvitationIds}
                saving={saving}
                resendingInvitationId={resendingInvitationId}
                deletingInvitationId={deletingInvitationId}
                onToggleSelection={toggleInvitationSelection}
                onResend={handlers.handleResendInvitation}
                onDelete={(id) => setDeletingInvitationId(id)}
              />
            );
          }
        })}
      </div>

      {filteredMergedItems.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {users.length === 0 && pendingInvitations.length === 0
              ? 'Get started by creating a new user.'
              : 'Try adjusting your filters to see more results.'}
          </p>
        </div>
      )}

      {/* Modals */}
      <EditPermissionsModal
        isOpen={!!editingPermissions}
        onClose={handlers.handleCancelEditPermissions}
        editingPermissions={editingPermissions}
        editRole={editRole}
        editOwnerId={editOwnerId}
        editEmail={editEmail}
        editFirstName={editFirstName}
        editLastName={editLastName}
        owners={owners}
        currentUserId={user?.id}
        saving={saving}
        onSave={handlers.handleSavePermissions}
        onRoleChange={setEditRole}
        onOwnerIdChange={setEditOwnerId}
        onEmailChange={setEditEmail}
        onFirstNameChange={setEditFirstName}
        onLastNameChange={setEditLastName}
      />

      <SetPasswordModal
        isOpen={!!passwordEditUserId}
        onClose={() => {
          setPasswordEditUserId(null);
          setNewPassword('');
        }}
        passwordEditUserId={passwordEditUserId}
        newPassword={newPassword}
        saving={saving}
        onPasswordChange={setNewPassword}
        onUpdate={handlers.handleUpdatePassword}
      />

      <ResetPasswordModal
        isOpen={!!resetPasswordConfirm}
        onClose={() => setResetPasswordConfirm(null)}
        resetPasswordConfirm={resetPasswordConfirm}
        saving={saving}
        onConfirm={handlers.handleResetPassword}
      />

      <DeleteUserModal
        isOpen={!!deleteConfirmId}
        onClose={() => {
          setDeleteConfirmId(null);
          setDeleteAction('delete');
        }}
        deleteConfirmId={deleteConfirmId}
        deleteAction={deleteAction}
        saving={saving}
        onActionChange={setDeleteAction}
        onConfirm={handlers.handleDelete}
      />

      <UserStatsModal
        isOpen={!!viewingStatsUserId}
        onClose={() => {
          setViewingStatsUserId(null);
          setUserStats(null);
        }}
        viewingStatsUserId={viewingStatsUserId}
        userStats={userStats}
        loadingStats={loadingStats}
      />

      <BulkEditPermissionsModal
        isOpen={bulkEditPermissions}
        onClose={() => {
          setBulkEditPermissions(false);
          setBulkRole('registered');
          setBulkOwnerId(null);
        }}
        selectedCount={selectedCount}
        bulkRole={bulkRole}
        bulkOwnerId={bulkOwnerId}
        owners={owners}
        saving={saving}
        onRoleChange={setBulkRole}
        onOwnerIdChange={setBulkOwnerId}
        onConfirm={handlers.handleBulkRoleAssignment}
      />

      <BulkDeleteModal
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        selectedUserIds={selectedUserIds}
        selectedInvitationIds={selectedInvitationIds}
        users={users}
        pendingInvitations={pendingInvitations}
        selectedCount={selectedCount}
        saving={saving}
        onConfirm={handlers.handleBulkDelete}
      />

      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => {
          setShowInviteModal(false);
          setInviteEmail('');
          setInviteOwnerId(null);
          setInviteRole('registered');
        }}
        inviteEmail={inviteEmail}
        inviteOwnerId={inviteOwnerId}
        inviteRole={inviteRole}
        isSuperAdmin={isSuperAdmin}
        isOwnerAdmin={isOwnerAdmin}
        ownerGroups={ownerGroups}
        owners={owners}
        inviting={inviting}
        onEmailChange={setInviteEmail}
        onOwnerIdChange={setInviteOwnerId}
        onRoleChange={setInviteRole}
        onConfirm={handlers.handleInviteUser}
      />

      <DeleteInvitationModal
        isOpen={!!deletingInvitationId}
        onClose={() => setDeletingInvitationId(null)}
        deletingInvitationId={deletingInvitationId}
        pendingInvitations={pendingInvitations}
        saving={saving}
        onConfirm={handlers.handleDeleteInvitation}
      />
    </div>
  );
}

