import { useState } from 'react';
import type { UserWithRoles, PendingInvitation } from '@/types/admin';
import { isProtectedSuperAdmin } from '../utils';

export function useUsersSelection(users: UserWithRoles[], invitations: PendingInvitation[] = []) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedInvitationIds, setSelectedInvitationIds] = useState<Set<string>>(new Set());

  const getSelectableUsers = () => {
    return users.filter(u => !isProtectedSuperAdmin(u));
  };

  const getSelectableInvitations = () => {
    return invitations; // All invitations are selectable
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

  const toggleInvitationSelection = (invitationId: string) => {
    setSelectedInvitationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(invitationId)) {
        newSet.delete(invitationId);
      } else {
        newSet.add(invitationId);
      }
      return newSet;
    });
  };

  const toggleSelection = (id: string, isInvitation: boolean) => {
    if (isInvitation) {
      toggleInvitationSelection(id);
    } else {
      toggleUserSelection(id);
    }
  };

  const toggleSelectAll = () => {
    const selectableUsers = getSelectableUsers();
    const selectableInvitations = getSelectableInvitations();
    const allSelectable = [...selectableUsers.map(u => ({ id: u.id, isInvitation: false })), ...selectableInvitations.map(i => ({ id: i.id, isInvitation: true }))];
    
    const allSelected = allSelectable.every(item => 
      item.isInvitation 
        ? selectedInvitationIds.has(item.id)
        : selectedUserIds.has(item.id)
    );
    
    if (allSelected) {
      setSelectedUserIds(new Set());
      setSelectedInvitationIds(new Set());
    } else {
      setSelectedUserIds(new Set(selectableUsers.map(u => u.id)));
      setSelectedInvitationIds(new Set(selectableInvitations.map(i => i.id)));
    }
  };

  const selectableUsersCount = getSelectableUsers().length;
  const selectableInvitationsCount = getSelectableInvitations().length;
  const selectableCount = selectableUsersCount + selectableInvitationsCount;
  const selectedCount = selectedUserIds.size + selectedInvitationIds.size;
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;
  const someSelected = selectedCount > 0 && selectedCount < selectableCount;

  return {
    selectedUserIds,
    selectedInvitationIds,
    setSelectedUserIds,
    setSelectedInvitationIds,
    toggleUserSelection,
    toggleInvitationSelection,
    toggleSelection,
    toggleSelectAll,
    selectedCount,
    selectableCount,
    allSelected,
    someSelected,
    getSelectableUsers,
    getSelectableInvitations,
  };
}


