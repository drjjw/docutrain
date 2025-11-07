import { useState, useEffect, useRef } from 'react';
import type { DocumentWithOwner } from '@/types/admin';
import type { UseDocumentsSelectionReturn } from '../types';

interface UseDocumentsSelectionProps {
  paginatedDocuments: DocumentWithOwner[];
}

export function useDocumentsSelection({
  paginatedDocuments,
}: UseDocumentsSelectionProps): UseDocumentsSelectionReturn {
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  const isAllSelected = paginatedDocuments.length > 0 && selectedDocIds.size === paginatedDocuments.length;
  const isSomeSelected = selectedDocIds.size > 0 && selectedDocIds.size < paginatedDocuments.length;

  // Set indeterminate state on select all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.size === paginatedDocuments.length) {
      // Deselect all on current page
      setSelectedDocIds(new Set());
    } else {
      // Select all on current page
      const allIds = new Set(paginatedDocuments.map(doc => doc.id));
      setSelectedDocIds(allIds);
    }
  };

  const clearSelection = () => {
    setSelectedDocIds(new Set());
  };

  return {
    selectedDocIds,
    isAllSelected,
    isSomeSelected,
    selectAllCheckboxRef,
    toggleDocumentSelection,
    toggleSelectAll,
    clearSelection,
  };
}

