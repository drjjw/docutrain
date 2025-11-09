/**
 * ChatModals Component
 * 
 * Renders all modal dialogs used in the chat interface:
 * - DisclaimerModal: Medical/educational content disclaimer
 * - PasscodeModal: Document passcode entry
 * - DocumentOwnerModal: Owner/document selection
 * - DocumentSelector: Document selection when owner is specified
 */

import { DisclaimerModal } from '@/components/Auth/DisclaimerModal';
import { PasscodeModal } from '@/components/Chat/PasscodeModal';
import { DocumentOwnerModal } from '@/components/Chat/DocumentOwnerModal';
import { DocumentSelector } from '@/components/Chat/DocumentSelector';

interface ErrorDetails {
  type?: string;
  message?: string;
  documentInfo?: {
    title?: string;
  };
}

interface ChatModalsProps {
  // Disclaimer
  needsDisclaimer: boolean;
  disclaimerAccepted: boolean;
  disclaimerText?: string | null;
  onDisclaimerAccept: () => void;
  onDisclaimerDecline: () => void;
  
  // Passcode
  shouldShowPasscodeModal: boolean;
  documentSlug: string | null;
  errorDetails: ErrorDetails | null;
  
  // Document Owner Modal
  shouldShowDocumentOwnerModal: boolean;
  isDocumentNotFound: boolean;
  
  // Document Selector
  shouldShowDocumentSelectorModal: boolean;
  hasAuthError: boolean;
  
  // Owner Not Found
  ownerNotFound: { slug: string; message: string } | null;
  onOwnerNotFound: (ownerSlug: string) => void;
}

export function ChatModals({
  needsDisclaimer,
  disclaimerAccepted,
  disclaimerText,
  onDisclaimerAccept,
  onDisclaimerDecline,
  shouldShowPasscodeModal,
  documentSlug,
  errorDetails,
  shouldShowDocumentOwnerModal,
  isDocumentNotFound,
  shouldShowDocumentSelectorModal,
  hasAuthError,
  ownerNotFound,
  onOwnerNotFound,
}: ChatModalsProps) {
  return (
    <>
      {/* Disclaimer Modal - shown for documents with show_disclaimer enabled */}
      <DisclaimerModal
        shouldShow={needsDisclaimer && !disclaimerAccepted}
        documentSlug={documentSlug}
        disclaimerText={disclaimerText}
        onAccept={onDisclaimerAccept}
        onDecline={onDisclaimerDecline}
      />
      
      {/* Passcode Modal - shown when passcode is required */}
      {shouldShowPasscodeModal && (
        <PasscodeModal
          isOpen={true}
          documentSlug={documentSlug!}
          documentTitle={errorDetails?.documentInfo?.title || documentSlug!}
          onClose={() => {
            // Force modal close - context should handle clearing errorDetails
            // This prevents modal from re-opening if there's a timing issue
          }}
        />
      )}
      
      {/* Document/Owner Selection Modal - shown when no document is selected and no owner param */}
      {/* Also shown when document is not found (404) or access is denied or owner is not found */}
      <DocumentOwnerModal 
        isOpen={shouldShowDocumentOwnerModal}
        customMessage={
          ownerNotFound
            ? ownerNotFound.message
            : (isDocumentNotFound || errorDetails?.type === 'access_denied' 
                ? errorDetails?.message 
                : undefined)
        }
        attemptedSlug={
          ownerNotFound
            ? ownerNotFound.slug
            : (isDocumentNotFound || errorDetails?.type === 'access_denied'
                ? documentSlug || undefined 
                : undefined)
        }
      />
      
      {/* Document Selector Modal - shown when owner param is present but no doc is selected */}
      {/* DocumentSelector renders its own modal via portal when in modal mode */}
      {shouldShowDocumentSelectorModal && (
        <DocumentSelector 
          currentDocSlug={null} 
          hasAuthError={hasAuthError}
          onOwnerNotFound={onOwnerNotFound}
        />
      )}
    </>
  );
}



