import React from 'react';
import type { Owner } from '@/types/admin';
import type { RoleFilter, StatusFilter, TypeFilter } from '../hooks/useUsersFiltering';

interface UserFiltersProps {
  searchQuery: string;
  roleFilter: RoleFilter;
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  ownerFilter: string;
  owners: Owner[];
  isSuperAdmin: boolean;
  totalUsers: number;
  totalInvitations: number;
  filteredUsers: number;
  filteredInvitations: number;
  onSearchChange: (query: string) => void;
  onRoleFilterChange: (filter: RoleFilter) => void;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onTypeFilterChange: (filter: TypeFilter) => void;
  onOwnerFilterChange: (filter: string) => void;
  onClearFilters: () => void;
}

export function UserFilters({
  searchQuery,
  roleFilter,
  statusFilter,
  typeFilter,
  ownerFilter,
  owners,
  isSuperAdmin,
  totalUsers,
  totalInvitations,
  filteredUsers,
  filteredInvitations,
  onSearchChange,
  onRoleFilterChange,
  onStatusFilterChange,
  onTypeFilterChange,
  onOwnerFilterChange,
  onClearFilters,
}: UserFiltersProps) {
  const hasActiveFilters = searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all' || ownerFilter !== 'all';
  const totalItems = totalUsers + totalInvitations;
  const filteredItems = filteredUsers + filteredInvitations;

  return (
    <div className="space-y-4">
      {/* Search Bar - Full width on mobile */}
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search users by email or name ..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl leading-5 bg-white/80 backdrop-blur-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 focus:border-docutrain-light shadow-sm hover:shadow-md transition-all duration-200 sm:text-sm"
        />
      </div>

      {/* Filters Grid - Stack on mobile, row on desktop */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
        {/* Type Filter */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value as TypeFilter)}
            className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 focus:border-docutrain-light shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
          >
            <option value="all">All Types</option>
            <option value="users">Users</option>
            <option value="invitations">Invitations</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Role Filter */}
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => onRoleFilterChange(e.target.value as RoleFilter)}
            className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 focus:border-docutrain-light shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
          >
            <option value="all">All Roles</option>
            <option value="registered">Registered</option>
            <option value="owner_admin">Owner Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
            className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 focus:border-docutrain-light shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
          >
            <option value="all">All Status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
            <option value="banned">Banned</option>
            <option value="pending">Pending</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Owner Filter (Super Admin only) */}
        {isSuperAdmin && (
          <div className="relative">
            <select
              value={ownerFilter}
              onChange={(e) => onOwnerFilterChange(e.target.value)}
              className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-docutrain-light/20 focus:border-docutrain-light shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
            >
              <option value="all">All Owners</option>
              {owners.map(owner => (
                <option key={owner.id} value={owner.id}>{owner.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Filters Active Notice & Clear Button */}
      {hasActiveFilters && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium text-amber-800">
              Filters Active, not all items visible ({filteredItems} of {totalItems} shown)
            </span>
          </div>
          <button
            onClick={onClearFilters}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-sm sm:text-base whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}

