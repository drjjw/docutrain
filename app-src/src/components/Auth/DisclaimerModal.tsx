/**
 * DisclaimerModal - Document Disclaimer
 * 
 * Shows a configurable disclaimer for documents that require user acknowledgment.
 * 
 * Uses session cookies to remember consent (expires when browser closes)
 */

import { useEffect, useState, useContext } from 'react';
import Cookies from 'js-cookie';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';
import { AlertTriangle } from 'lucide-react';
import { DocumentAccessContext } from '@/contexts/DocumentAccessContext';

const COOKIE_NAME = '_document_disclaimer_agree';
const DEFAULT_DISCLAIMER_TEXT = 'This content is provided for informational purposes only. Please review and verify all information before use.';

interface DisclaimerModalProps {
  /** Whether the modal should be shown */
  shouldShow: boolean;
  /** Custom disclaimer text (optional - uses default if not provided) */
  disclaimerText?: string | null;
  /** Callback when user accepts */
  onAccept: () => void;
  /** Callback when user declines */
  onDecline: () => void;
}

export function DisclaimerModal({ shouldShow, disclaimerText, onAccept, onDecline }: DisclaimerModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Use custom text if provided, otherwise use default
  const displayText = disclaimerText || DEFAULT_DISCLAIMER_TEXT;
  
  // Parse the text into paragraphs if it contains newlines
  const textParagraphs = displayText.split('\n').filter(p => p.trim().length > 0);

  useEffect(() => {
    if (shouldShow) {
      // Check if running in iframe (parent handles disclaimer)
      if (window.self !== window.top) {
        console.log('🖼️  Running in iframe - disclaimer handled by parent');
        onAccept(); // Auto-accept in iframe context
        return;
      }

      // Check if user has already agreed
      if (Cookies.get(COOKIE_NAME)) {
        console.log('✅ Disclaimer already accepted');
        onAccept(); // Auto-accept if cookie exists
        return;
      }

      // Show disclaimer after a short delay for better UX
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [shouldShow, onAccept]);

  const handleAccept = () => {
    // Set session cookie (expires when browser closes)
    Cookies.set(COOKIE_NAME, 'Yes', { 
      path: '/'
      // No expires property = session cookie
    });
    console.log('✅ User accepted disclaimer (session only)');
    setIsOpen(false);
    onAccept();
  };

  const handleDecline = () => {
    console.log('❌ User declined disclaimer');
    setIsOpen(false);
    onDecline();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Prevent closing by clicking outside
      title={
        <div className="flex items-center gap-2">
          <AlertTriangle className="text-yellow-600" size={24} />
          <span>Important Disclaimer</span>
        </div>
      }
      size="md"
      allowClose={false} // Prevent X button
    >
      <div className="flex flex-col" style={{ maxHeight: 'calc(60vh - 120px)' }}>
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2 min-h-0">
          <div className="text-left space-y-4 text-gray-700">
            {textParagraphs.length > 1 ? (
              textParagraphs.map((paragraph, index) => (
                <p key={index} dangerouslySetInnerHTML={{ __html: paragraph }} />
              ))
            ) : (
              <p dangerouslySetInnerHTML={{ __html: displayText }} />
            )}
            <p className="text-sm text-gray-600 pt-2 border-t">
              By using this service, you also agree to our{' '}
              <a 
                href="/app/terms" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Terms of Service
              </a>
              .
            </p>
          </div>
        </div>

        {/* Fixed footer with buttons */}
        <div className="flex justify-end space-x-3 pt-4 mt-4 border-t flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={handleDecline}
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            I Decline
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAccept}
          >
            I Agree
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Hook to manage disclaimer state
 * Supports both single and multi-document scenarios
 * 
 * @param documentSlug - Single slug or comma-separated slugs (e.g., "doc1,doc2,doc3")
 */
interface UseDisclaimerOptions {
  documentSlug: string | null | undefined;
  hasAuthError?: boolean; // Skip fetch if we already know auth is required
}

export function useDisclaimer(options: string | null | undefined | UseDisclaimerOptions) {
  // Support both old signature (string) and new signature (object)
  const documentSlug = typeof options === 'string' || options === null || options === undefined 
    ? options 
    : options.documentSlug;
  const hasAuthError = typeof options === 'object' && options !== null 
    ? options.hasAuthError 
    : false;
    
  const [needsDisclaimer, setNeedsDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  
  // Get document context (now the single source of truth)
  const documentContext = useContext(DocumentAccessContext) || undefined;

  useEffect(() => {
    // Skip if auth error already detected (passcode required, access denied, etc.)
    if (hasAuthError) {
      console.log('[useDisclaimer] Auth error detected, skipping disclaimer check');
      setNeedsDisclaimer(false);
      setDisclaimerAccepted(true);
      setIsChecking(false);
      return;
    }

    if (!documentSlug) {
      setNeedsDisclaimer(false);
      setDisclaimerAccepted(true); // No document = no disclaimer needed
      setIsChecking(false);
      return;
    }

    // Wait for document context to be ready
    if (!documentContext || documentContext.loading) {
      setIsChecking(true);
      return;
    }

    setIsChecking(false);

    // If we have document config, check if it requires disclaimer
    if (documentContext.config) {
      console.log('[useDisclaimer] Using document from context');
      const requiresDisclaimer = documentContext.config.showDisclaimer === true;

      if (requiresDisclaimer) {
        console.log('[useDisclaimer] Document requires disclaimer');
        setNeedsDisclaimer(true);
        setDisclaimerAccepted(false);
      } else {
        console.log('[useDisclaimer] Document does not require disclaimer');
        setNeedsDisclaimer(false);
        setDisclaimerAccepted(true);
      }
      return;
    }

    // If no config but no error (document doesn't exist or access denied), skip disclaimer
    if (!documentContext.config && !documentContext.error) {
      console.log('[useDisclaimer] No document config available, skipping disclaimer');
      setNeedsDisclaimer(false);
      setDisclaimerAccepted(true);
      return;
    }

    // If there's an error (passcode required, access denied, etc.), skip disclaimer
    if (documentContext.errorDetails) {
      console.log('[useDisclaimer] Document access error, skipping disclaimer check');
      setNeedsDisclaimer(false);
      setDisclaimerAccepted(true);
      return;
    }

    // Default: no disclaimer needed
    setNeedsDisclaimer(false);
    setDisclaimerAccepted(true);
  }, [documentSlug, hasAuthError, documentContext?.config, documentContext?.loading, documentContext?.errorDetails]);

  const handleAccept = () => {
    setDisclaimerAccepted(true);
  };

  const handleDecline = () => {
    // Redirect to disclaimer declined page
    window.location.href = '/app/disclaimer-declined';
  };

  return {
    needsDisclaimer,
    disclaimerAccepted,
    isChecking,
    handleAccept,
    handleDecline,
  };
}

/**
 * Utility function to clear disclaimer cookie (useful for testing)
 */
export function clearDisclaimerCookie() {
  Cookies.remove(COOKIE_NAME, { path: '/' });
  console.log('🗑️  Disclaimer cookie cleared');
}

/**
 * Utility function to check if user has accepted disclaimer
 */
export function hasAcceptedDisclaimer() {
  return !!Cookies.get(COOKIE_NAME);
}

