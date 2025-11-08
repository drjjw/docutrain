/**
 * useModalState - Hook for determining which modal should be shown
 * Handles passcode modal, document/owner selection modal, and document selector modal
 * Ported from ChatPage.tsx
 */

import { DocumentConfigError } from './useDocumentConfig';

export function useModalState(
  errorDetails: DocumentConfigError | null,
  documentSlug: string | null,
  ownerParam: string | null,
  ownerNotFound: { slug: string; message: string } | null = null
) {
  // Check if we should show passcode modal
  const shouldShowPasscodeModal = errorDetails?.type === 'passcode_required' && !!documentSlug;
  
  // Check if we should show the document/owner selection modal
  // Show when:
  // 1. No document is selected and no owner parameter is present, OR
  // 2. Document was not found (404 error), OR
  // 3. Access denied error (user logged in but doesn't have permission), OR
  // 4. Owner was not found (404 error)
  const isDocumentNotFound = errorDetails?.type === 'document_not_found';
  const isAccessDenied = errorDetails?.type === 'access_denied';
  const isOwnerNotFound = !!ownerNotFound;
  const shouldShowDocumentOwnerModal = (!documentSlug && !ownerParam) || isDocumentNotFound || isAccessDenied || isOwnerNotFound;

  // When owner param is present but no doc is selected, DocumentSelector should show as modal
  // DocumentSelector handles its own modal rendering when in modal mode
  // Don't show selector if access is denied or owner is not found
  const shouldShowDocumentSelectorModal = !!ownerParam && !documentSlug && !isAccessDenied && !isOwnerNotFound;

  return {
    shouldShowPasscodeModal,
    shouldShowDocumentOwnerModal,
    shouldShowDocumentSelectorModal,
    isDocumentNotFound,
  };
}
