import { useState, useEffect } from 'react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentWithOwner[]>(documents);

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

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setVisibilityFilter('all');
    setCategoryFilter('all');
    setOwnerFilter('all');
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

