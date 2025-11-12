import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { UserWithRoles, PendingInvitation } from '@/types/admin';

export type RoleFilter = 'all' | 'registered' | 'owner_admin' | 'super_admin';
export type StatusFilter = 'all' | 'verified' | 'unverified' | 'banned' | 'pending';
export type TypeFilter = 'all' | 'users' | 'invitations';

export interface UseUsersFilteringReturn {
  filteredUsers: UserWithRoles[];
  filteredInvitations: PendingInvitation[];
  filteredMergedItems: Array<{
    type: 'user' | 'invitation';
    id: string;
    email: string;
    created_at: string;
    data: UserWithRoles | PendingInvitation;
  }>;
  searchQuery: string;
  roleFilter: RoleFilter;
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  ownerFilter: string;
  setSearchQuery: (query: string) => void;
  setRoleFilter: (filter: RoleFilter) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setTypeFilter: (filter: TypeFilter) => void;
  setOwnerFilter: (filter: string) => void;
  clearAllFilters: () => void;
}

interface UseUsersFilteringProps {
  users: UserWithRoles[];
  pendingInvitations: PendingInvitation[];
  isSuperAdmin: boolean;
}

export function useUsersFiltering({
  users,
  pendingInvitations,
  isSuperAdmin,
}: UseUsersFilteringProps): UseUsersFilteringReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize filters from URL parameters or defaults
  const getInitialSearchQuery = () => searchParams.get('search') || '';
  const getInitialRoleFilter = (): RoleFilter => {
    const value = searchParams.get('role');
    return (value === 'registered' || value === 'owner_admin' || value === 'super_admin') ? value : 'all';
  };
  const getInitialStatusFilter = (): StatusFilter => {
    const value = searchParams.get('status');
    return (value === 'verified' || value === 'unverified' || value === 'banned' || value === 'pending') ? value : 'all';
  };
  const getInitialTypeFilter = (): TypeFilter => {
    const value = searchParams.get('type');
    return (value === 'users' || value === 'invitations') ? value : 'all';
  };
  const getInitialOwnerFilter = () => searchParams.get('owner') || 'all';
  
  const [searchQuery, setSearchQueryState] = useState(getInitialSearchQuery);
  const [roleFilter, setRoleFilterState] = useState<RoleFilter>(getInitialRoleFilter);
  const [statusFilter, setStatusFilterState] = useState<StatusFilter>(getInitialStatusFilter);
  const [typeFilter, setTypeFilterState] = useState<TypeFilter>(getInitialTypeFilter);
  const [ownerFilter, setOwnerFilterState] = useState<string>(getInitialOwnerFilter);
  
  // Wrapper functions that update both state and URL
  const setSearchQuery = (query: string) => {
    setSearchQueryState(query);
    const newParams = new URLSearchParams(searchParams);
    if (query) {
      newParams.set('search', query);
    } else {
      newParams.delete('search');
    }
    setSearchParams(newParams, { replace: true });
  };
  
  const setRoleFilter = (filter: RoleFilter) => {
    setRoleFilterState(filter);
    const newParams = new URLSearchParams(searchParams);
    if (filter !== 'all') {
      newParams.set('role', filter);
    } else {
      newParams.delete('role');
    }
    setSearchParams(newParams, { replace: true });
  };
  
  const setStatusFilter = (filter: StatusFilter) => {
    setStatusFilterState(filter);
    const newParams = new URLSearchParams(searchParams);
    if (filter !== 'all') {
      newParams.set('status', filter);
    } else {
      newParams.delete('status');
    }
    setSearchParams(newParams, { replace: true });
  };
  
  const setTypeFilter = (filter: TypeFilter) => {
    setTypeFilterState(filter);
    const newParams = new URLSearchParams(searchParams);
    if (filter !== 'all') {
      newParams.set('type', filter);
    } else {
      newParams.delete('type');
    }
    setSearchParams(newParams, { replace: true });
  };
  
  const setOwnerFilter = (filter: string) => {
    setOwnerFilterState(filter);
    const newParams = new URLSearchParams(searchParams);
    if (filter !== 'all') {
      newParams.set('owner', filter);
    } else {
      newParams.delete('owner');
    }
    setSearchParams(newParams, { replace: true });
  };

  // Helper function to check if user has a specific role
  const userHasRole = (user: UserWithRoles, role: 'registered' | 'owner_admin' | 'super_admin'): boolean => {
    const roles = user.roles || [];
    const ownerGroups = user.owner_groups || [];
    
    if (role === 'super_admin') {
      return roles.some(r => r.role === 'super_admin') || 
             ownerGroups.some(og => og.role === 'super_admin');
    }
    
    if (role === 'owner_admin') {
      return roles.some(r => r.role === 'owner_admin') || 
             ownerGroups.some(og => og.role === 'owner_admin');
    }
    
    // For registered, check if they have registered role but not admin roles
    const hasAdminRole = roles.some(r => r.role === 'owner_admin' || r.role === 'super_admin') ||
                        ownerGroups.some(og => og.role === 'owner_admin' || og.role === 'super_admin');
    return !hasAdminRole && (roles.length > 0 || ownerGroups.length > 0);
  };

  // Helper function to get user's primary owner_id
  const getUserOwnerId = (user: UserWithRoles): string | null => {
    const ownerGroups = user.owner_groups || [];
    if (ownerGroups.length > 0) {
      return ownerGroups[0].owner_id;
    }
    const roles = user.roles || [];
    const ownerAdminRole = roles.find(r => r.role === 'owner_admin');
    return ownerAdminRole?.owner_id || null;
  };

  // Filter users and invitations based on search query and filters
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => (
        user.email?.toLowerCase().includes(query) ||
        user.first_name?.toLowerCase().includes(query) ||
        user.last_name?.toLowerCase().includes(query) ||
        `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(query)
      ));
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => userHasRole(user, roleFilter));
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => {
        if (statusFilter === 'verified') {
          return !!user.email_confirmed_at;
        }
        if (statusFilter === 'unverified') {
          return !user.email_confirmed_at;
        }
        if (statusFilter === 'banned') {
          return user.banned_until && new Date(user.banned_until) > new Date();
        }
        if (statusFilter === 'pending') {
          const hasRoles = user.roles && user.roles.length > 0;
          const hasOwnerGroups = user.owner_groups && user.owner_groups.length > 0;
          return !hasRoles && !hasOwnerGroups;
        }
        return true;
      });
    }

    // Apply owner filter (super admin only)
    if (isSuperAdmin && ownerFilter !== 'all') {
      filtered = filtered.filter(user => {
        const userOwnerId = getUserOwnerId(user);
        return userOwnerId === ownerFilter;
      });
    }

    return filtered;
  }, [users, searchQuery, roleFilter, statusFilter, ownerFilter, isSuperAdmin]);

  const filteredInvitations = useMemo(() => {
    let filtered = pendingInvitations;

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(invitation => 
        invitation.email?.toLowerCase().includes(query)
      );
    }

    // Apply status filter (for invitations, "pending" means not expired)
    if (statusFilter === 'pending') {
      filtered = filtered.filter(invitation => !invitation.is_expired);
    } else if (statusFilter !== 'all' && statusFilter !== 'pending') {
      // Other status filters don't apply to invitations
      filtered = [];
    }

    // Apply owner filter (super admin only)
    if (isSuperAdmin && ownerFilter !== 'all') {
      filtered = filtered.filter(invitation => invitation.owner_id === ownerFilter);
    }

    return filtered;
  }, [pendingInvitations, searchQuery, statusFilter, ownerFilter, isSuperAdmin]);

  // Create merged items for display
  const filteredMergedItems = useMemo(() => {
    const userItems = filteredUsers.map(user => ({
      type: 'user' as const,
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      data: user,
    }));
    
    const invitationItems = filteredInvitations.map(invitation => ({
      type: 'invitation' as const,
      id: invitation.id,
      email: invitation.email,
      created_at: invitation.created_at,
      data: invitation,
    }));
    
    // Apply type filter
    let items: typeof userItems | typeof invitationItems | Array<typeof userItems[0] | typeof invitationItems[0]> = [];
    
    if (typeFilter === 'users') {
      items = userItems;
    } else if (typeFilter === 'invitations') {
      items = invitationItems;
    } else {
      items = [...userItems, ...invitationItems];
    }
    
    return items.sort((a, b) => {
      // Sort by email alphabetically
      return a.email.localeCompare(b.email);
    });
  }, [filteredUsers, filteredInvitations, typeFilter]);

  // Sync state when URL parameters change (e.g., browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlRole = searchParams.get('role');
    const urlStatus = searchParams.get('status');
    const urlType = searchParams.get('type');
    const urlOwner = searchParams.get('owner') || 'all';
    
    setSearchQueryState(urlSearch);
    setRoleFilterState((urlRole === 'registered' || urlRole === 'owner_admin' || urlRole === 'super_admin') ? urlRole : 'all');
    setStatusFilterState((urlStatus === 'verified' || urlStatus === 'unverified' || urlStatus === 'banned' || urlStatus === 'pending') ? urlStatus : 'all');
    setTypeFilterState((urlType === 'users' || urlType === 'invitations') ? urlType : 'all');
    setOwnerFilterState(urlOwner);
  }, [searchParams]);
  
  const clearAllFilters = () => {
    setSearchQueryState('');
    setRoleFilterState('all');
    setStatusFilterState('all');
    setTypeFilterState('all');
    setOwnerFilterState('all');
    // Clear all filter-related URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.delete('role');
    newParams.delete('status');
    newParams.delete('type');
    newParams.delete('owner');
    setSearchParams(newParams, { replace: true });
  };

  return {
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
  };
}





