/**
 * useModalState - Hook for determining which modal should be shown
 * Handles passcode modal, document/owner selection modal, and document selector modal
 * Ported from ChatPage.tsx
 */

import { DocumentConfigError } from './useDocumentConfig';

export function useModalState(
  errorDetails: DocumentConfigError | null,
  documentSlug: string | null,
  ownerParam: string | null
) {
  // Check if we should show passcode modal
  const shouldShowPasscodeModal = errorDetails?.type === 'passcode_required' && !!documentSlug;
  
  // Check if we should show the document/owner selection modal
  // Show when:
  // 1. No document is selected and no owner parameter is present, OR
  // 2. Document was not found (404 error)
  const isDocumentNotFound = errorDetails?.type === 'document_not_found';
  const shouldShowDocumentOwnerModal = (!documentSlug && !ownerParam) || isDocumentNotFound;

  // When owner param is present but no doc is selected, DocumentSelector should show as modal
  // DocumentSelector handles its own modal rendering when in modal mode
  const shouldShowDocumentSelectorModal = !!ownerParam && !documentSlug;

  return {
    shouldShowPasscodeModal,
    shouldShowDocumentOwnerModal,
    shouldShowDocumentSelectorModal,
    isDocumentNotFound,
  };
}
