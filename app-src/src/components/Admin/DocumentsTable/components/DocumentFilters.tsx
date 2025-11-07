import React from 'react';
import type { Owner } from '@/types/admin';
import type { StatusFilter, VisibilityFilter } from '../types';

interface DocumentFiltersProps {
  searchQuery: string;
  statusFilter: StatusFilter;
  visibilityFilter: VisibilityFilter;
  categoryFilter: string;
  ownerFilter: string;
  owners: Owner[];
  isSuperAdmin: boolean;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onVisibilityFilterChange: (filter: VisibilityFilter) => void;
  onCategoryFilterChange: (filter: string) => void;
  onOwnerFilterChange: (filter: string) => void;
  onClearFilters: () => void;
}

export function DocumentFilters({
  searchQuery,
  statusFilter,
  visibilityFilter,
  categoryFilter,
  ownerFilter,
  owners,
  isSuperAdmin,
  onSearchChange,
  onStatusFilterChange,
  onVisibilityFilterChange,
  onCategoryFilterChange,
  onOwnerFilterChange,
  onClearFilters,
}: DocumentFiltersProps) {
  const hasActiveFilters = searchQuery || statusFilter !== 'all' || visibilityFilter !== 'all' || categoryFilter !== 'all' || ownerFilter !== 'all';

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
          placeholder="Search documents ..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl leading-5 bg-white/80 backdrop-blur-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 sm:text-sm"
        />
      </div>

      {/* Filters Grid - Stack on mobile, row on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
            className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Visibility Filter */}
        <div className="relative">
          <select
            value={visibilityFilter}
            onChange={(e) => onVisibilityFilterChange(e.target.value as VisibilityFilter)}
            className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
          >
            <option value="all">All Access Levels</option>
            <option value="public">Public</option>
            <option value="passcode">Passcode</option>
            <option value="registered">Registered</option>
            <option value="owner_restricted">Owner</option>
            <option value="owner_admin_only">Owner Admins Only</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Category Filter */}
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
          >
            <option value="all">All Categories</option>
            <option value="Guidelines">Guidelines</option>
            <option value="Maker">Maker</option>
            <option value="Manuals">Manuals</option>
            <option value="Presentation">Presentation</option>
            <option value="Recipes">Recipes</option>
            <option value="Reviews">Reviews</option>
            <option value="Slides">Slides</option>
            <option value="Training">Training</option>
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
              className="appearance-none bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm hover:shadow-md transition-all duration-200 w-full font-medium text-gray-700"
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

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear All Filters
        </button>
      )}
    </div>
  );
}

