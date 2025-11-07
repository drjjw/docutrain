import { useState, useEffect } from 'react';
import type { DocumentWithOwner } from '@/types/admin';
import type { UseDocumentsPaginationReturn } from '../types';

interface UseDocumentsPaginationProps {
  filteredDocuments: DocumentWithOwner[];
}

export function useDocumentsPagination({
  filteredDocuments,
}: UseDocumentsPaginationProps): UseDocumentsPaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Calculate paginated documents
  const effectiveItemsPerPage = itemsPerPage >= filteredDocuments.length ? filteredDocuments.length : itemsPerPage;
  const totalPages = effectiveItemsPerPage > 0 ? Math.ceil(filteredDocuments.length / effectiveItemsPerPage) : 1;
  const startIndex = (currentPage - 1) * effectiveItemsPerPage;
  const endIndex = startIndex + effectiveItemsPerPage;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Reset page when items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  // Reset page when filtered documents change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredDocuments.length]);

  return {
    paginatedDocuments,
    currentPage,
    itemsPerPage,
    totalPages,
    startIndex,
    endIndex,
    setCurrentPage,
    setItemsPerPage,
  };
}

