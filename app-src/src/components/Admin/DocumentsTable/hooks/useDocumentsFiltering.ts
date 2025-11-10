import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { DocumentWithOwner } from '@/types/admin';
import type { UseDocumentsFilteringReturn, StatusFilter, VisibilityFilter } from '../types';

interface UseDocumentsFilteringProps {
  documents: DocumentWithOwner[];
  isSuperAdmin: boolean;
}

export function useDocumentsFiltering({
  documents,
  isSuperAdmin,
}: UseDocumentsFilteringProps): UseDocumentsFilteringReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize filters from URL parameters or defaults
  const getInitialSearchQuery = () => searchParams.get('search') || '';
  const getInitialStatusFilter = (): StatusFilter => {
    const value = searchParams.get('status');
    return (value === 'active' || value === 'inactive') ? value : 'all';
  };
  const getInitialVisibilityFilter = (): VisibilityFilter => {
    const value = searchParams.get('visibility');
    return (value === 'public' || value === 'passcode' || value === 'registered' || value === 'owner_restricted' || value === 'owner_admin_only') ? value : 'all';
  };
  const getInitialCategoryFilter = () => searchParams.get('category') || 'all';
  const getInitialOwnerFilter = () => searchParams.get('owner') || 'all';
  
  const [searchQuery, setSearchQueryState] = useState(getInitialSearchQuery);
  const [statusFilter, setStatusFilterState] = useState<StatusFilter>(getInitialStatusFilter);
  const [visibilityFilter, setVisibilityFilterState] = useState<VisibilityFilter>(getInitialVisibilityFilter);
  const [categoryFilter, setCategoryFilterState] = useState<string>(getInitialCategoryFilter);
  const [ownerFilter, setOwnerFilterState] = useState<string>(getInitialOwnerFilter);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentWithOwner[]>(documents);
  
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
  
  const setVisibilityFilter = (filter: VisibilityFilter) => {
    setVisibilityFilterState(filter);
    const newParams = new URLSearchParams(searchParams);
    if (filter !== 'all') {
      newParams.set('visibility', filter);
    } else {
      newParams.delete('visibility');
    }
    setSearchParams(newParams, { replace: true });
  };
  
  const setCategoryFilter = (filter: string) => {
    setCategoryFilterState(filter);
    const newParams = new URLSearchParams(searchParams);
    if (filter !== 'all') {
      newParams.set('category', filter);
    } else {
      newParams.delete('category');
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

  // Filter documents based on search query and filters
  useEffect(() => {
    let filtered = documents;

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc => (
        doc.title?.toLowerCase().includes(query) ||
        doc.subtitle?.toLowerCase().includes(query) ||
        doc.slug?.toLowerCase().includes(query) ||
        doc.category?.toLowerCase().includes(query) ||
        doc.owners?.name?.toLowerCase().includes(query)
      ));
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => {
        const isActive = doc.active ?? false;
        return statusFilter === 'active' ? isActive : !isActive;
      });
    }

    // Apply visibility filter
    if (visibilityFilter !== 'all') {
      filtered = filtered.filter(doc => {
        const accessLevel = doc.access_level || 'public';
        return accessLevel === visibilityFilter;
      });
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(doc => doc.category === categoryFilter);
    }

    // Apply owner filter (super admin only)
    if (isSuperAdmin && ownerFilter !== 'all') {
      filtered = filtered.filter(doc => doc.owner_id === ownerFilter);
    }

    setFilteredDocuments(filtered);
  }, [documents, searchQuery, statusFilter, visibilityFilter, categoryFilter, ownerFilter, isSuperAdmin]);

  // Sync state when URL parameters change (e.g., browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlStatus = searchParams.get('status');
    const urlVisibility = searchParams.get('visibility');
    const urlCategory = searchParams.get('category') || 'all';
    const urlOwner = searchParams.get('owner') || 'all';
    
    setSearchQueryState(urlSearch);
    setStatusFilterState((urlStatus === 'active' || urlStatus === 'inactive') ? urlStatus : 'all');
    setVisibilityFilterState((urlVisibility === 'public' || urlVisibility === 'passcode' || urlVisibility === 'registered' || urlVisibility === 'owner_restricted' || urlVisibility === 'owner_admin_only') ? urlVisibility : 'all');
    setCategoryFilterState(urlCategory);
    setOwnerFilterState(urlOwner);
  }, [searchParams]);
  
  const clearAllFilters = () => {
    setSearchQueryState('');
    setStatusFilterState('all');
    setVisibilityFilterState('all');
    setCategoryFilterState('all');
    setOwnerFilterState('all');
    // Clear all filter-related URL parameters
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('search');
    newParams.delete('status');
    newParams.delete('visibility');
    newParams.delete('category');
    newParams.delete('owner');
    setSearchParams(newParams, { replace: true });
  };

  return {
    filteredDocuments,
    searchQuery,
    statusFilter,
    visibilityFilter,
    categoryFilter,
    ownerFilter,
    setSearchQuery,
    setStatusFilter,
    setVisibilityFilter,
    setCategoryFilter,
    setOwnerFilter,
    clearAllFilters,
  };
}

