import { useState } from 'react';
import type { UserWithRoles } from '@/types/admin';
import { isProtectedSuperAdmin } from '../utils';

export function useUsersSelection(users: UserWithRoles[]) {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const getSelectableUsers = () => {
    return users.filter(u => !isProtectedSuperAdmin(u));
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
    const selectableUsers = getSelectableUsers();
    const allSelected = selectableUsers.every(u => selectedUserIds.has(u.id));
    
    if (allSelected) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(selectableUsers.map(u => u.id)));
    }
  };

  const selectableCount = getSelectableUsers().length;
  const selectedCount = selectedUserIds.size;
  const allSelected = selectableCount > 0 && selectedCount === selectableCount;
  const someSelected = selectedCount > 0 && selectedCount < selectableCount;

  return {
    selectedUserIds,
    setSelectedUserIds,
    toggleUserSelection,
    toggleSelectAll,
    selectedCount,
    selectableCount,
    allSelected,
    someSelected,
    getSelectableUsers,
  };
}


