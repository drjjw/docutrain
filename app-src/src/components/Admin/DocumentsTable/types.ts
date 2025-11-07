import type { DocumentWithOwner, Owner } from '@/types/admin';

export interface DocumentsTableProps {
  isSuperAdmin?: boolean;
  onRetrainingStart?: (userDocumentId: string) => void;
}

export interface DocumentsTableRef {
  refresh: () => Promise<void>;
  openEditorModal: (documentId: string, showConfigPrompt?: boolean) => Promise<void>;
}

export type StatusFilter = 'all' | 'active' | 'inactive';
export type VisibilityFilter = 'all' | 'public' | 'passcode' | 'registered' | 'owner_restricted' | 'owner_admin_only';

export interface FilterState {
  searchQuery: string;
  statusFilter: StatusFilter;
  visibilityFilter: VisibilityFilter;
  categoryFilter: string;
  ownerFilter: string;
}

export interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
}

export interface BulkDeleteProgress {
  current: string | null;
  completed: string[];
  failed: Array<{ id: string; error: string }>;
  total: number;
}

export interface UseDocumentsDataReturn {
  documents: DocumentWithOwner[];
  owners: Owner[];
  loading: boolean;
  error: string | null;
  documentsRef: React.MutableRefObject<DocumentWithOwner[]>;
  loadData: (showLoading?: boolean) => Promise<void>;
  updateDocumentInState: (docId: string, updates: Partial<DocumentWithOwner>) => void;
}

export interface UseDocumentsFilteringReturn {
  filteredDocuments: DocumentWithOwner[];
  searchQuery: string;
  statusFilter: StatusFilter;
  visibilityFilter: VisibilityFilter;
  categoryFilter: string;
  ownerFilter: string;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setVisibilityFilter: (filter: VisibilityFilter) => void;
  setCategoryFilter: (filter: string) => void;
  setOwnerFilter: (filter: string) => void;
  clearAllFilters: () => void;
}

export interface UseDocumentsPaginationReturn {
  paginatedDocuments: DocumentWithOwner[];
  currentPage: number;
  itemsPerPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (items: number) => void;
}

export interface UseDocumentsSelectionReturn {
  selectedDocIds: Set<string>;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  selectAllCheckboxRef: React.RefObject<HTMLInputElement>;
  toggleDocumentSelection: (docId: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
}

