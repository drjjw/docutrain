/**
 * DisclaimerModal - Medical/Educational Use Disclaimer
 * 
 * Shows a disclaimer for documents owned by specific owners (e.g., ukidney)
 * that require users to acknowledge educational use only.
 * 
 * Uses session cookies to remember consent (expires when browser closes)
 */

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { Modal } from '@/components/UI/Modal';
import { Button } from '@/components/UI/Button';
import { AlertTriangle } from 'lucide-react';

const COOKIE_NAME = '_ukidney_disclaimer_agree';

interface DisclaimerModalProps {
  /** Whether the modal should be shown */
  shouldShow: boolean;
  /** Callback when user accepts */
  onAccept: () => void;
  /** Callback when user declines */
  onDecline: () => void;
}

export function DisclaimerModal({ shouldShow, onAccept, onDecline }: DisclaimerModalProps) {
  const [isOpen, setIsOpen] = useState(false);

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
      <div className="space-y-4">
        <div className="text-left space-y-4 text-gray-700">
          <p>
            This feature is intended <strong>for educational use only by healthcare professionals</strong>.
          </p>
          <p>
            Please verify all suggestions before considering use in patient care settings.
          </p>
          <p>
            If you agree with these terms, please acknowledge below, otherwise you will be redirected.
          </p>
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

        <div className="flex justify-end space-x-3 pt-4 border-t">
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
export function useDisclaimer(documentSlug: string | null | undefined) {
  const [needsDisclaimer, setNeedsDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!documentSlug) {
      setNeedsDisclaimer(false);
      setDisclaimerAccepted(true); // No document = no disclaimer needed
      return;
    }

    // Parse document slugs (could be comma-separated for multi-doc)
    const slugs = documentSlug.split(',').map(s => s.trim()).filter(Boolean);
    
    if (slugs.length === 0) {
      setNeedsDisclaimer(false);
      setDisclaimerAccepted(true);
      return;
    }

    // Check if any document requires disclaimer
    async function checkDocuments() {
      setIsChecking(true);
      try {
        // Fetch document info from API
        const apiUrl = `/api/documents?doc=${encodeURIComponent(documentSlug)}`;
        
        // Get JWT token if available
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        };

        try {
          const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
          const sessionData = localStorage.getItem(sessionKey);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            const token = session?.access_token;
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
          }
        } catch (error) {
          // Ignore token errors
        }

        const response = await fetch(apiUrl, { headers });
        
        if (!response.ok) {
          console.warn('[useDisclaimer] Failed to fetch documents, skipping disclaimer check');
          setNeedsDisclaimer(false);
          setDisclaimerAccepted(true);
          return;
        }

        const data = await response.json();
        const documents = data.documents || [];

        // Check if ANY document has owner === 'ukidney'
        const requiresDisclaimer = documents.some((doc: any) => doc.owner === 'ukidney');

        if (requiresDisclaimer) {
          console.log('[useDisclaimer] At least one ukidney document detected, disclaimer required');
          setNeedsDisclaimer(true);
          setDisclaimerAccepted(false);
        } else {
          console.log('[useDisclaimer] No ukidney documents, disclaimer not required');
          setNeedsDisclaimer(false);
          setDisclaimerAccepted(true);
        }
      } catch (error) {
        console.error('[useDisclaimer] Error checking documents:', error);
        // On error, don't block the user - skip disclaimer
        setNeedsDisclaimer(false);
        setDisclaimerAccepted(true);
      } finally {
        setIsChecking(false);
      }
    }

    checkDocuments();
  }, [documentSlug]);

  const handleAccept = () => {
    setDisclaimerAccepted(true);
  };

  const handleDecline = () => {
    // Redirect to home page
    window.location.href = '/';
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

