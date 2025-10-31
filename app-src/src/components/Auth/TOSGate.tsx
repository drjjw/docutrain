import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hasAcceptedTermsOfService, acceptTermsOfService } from '@/lib/supabase/database';
import { TermsOfServiceModal } from './TermsOfServiceModal';
import { Spinner } from '@/components/UI/Spinner';

interface TOSGateProps {
  children: React.ReactNode;
}

/**
 * TOSGate component that ensures users have accepted Terms of Service
 * before accessing protected routes. Shows TOS modal if not accepted.
 */
export function TOSGate({ children }: TOSGateProps) {
  const { user } = useAuth();
  const [tosAccepted, setTosAccepted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const checkTOS = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const accepted = await hasAcceptedTermsOfService(user.id);
        setTosAccepted(accepted);
      } catch (error) {
        console.error('Error checking TOS acceptance:', error);
        // On error, assume not accepted to be safe
        setTosAccepted(false);
      } finally {
        setLoading(false);
      }
    };

    checkTOS();
  }, [user?.id]);

  const handleAcceptTOS = async () => {
    if (!user?.id) return;

    try {
      setAccepting(true);
      await acceptTermsOfService(user.id, '2025-10-31');
      setTosAccepted(true);
    } catch (error) {
      console.error('Error accepting TOS:', error);
      // Show error but keep modal open
    } finally {
      setAccepting(false);
    }
  };

  // Show loading spinner while checking
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // If TOS not accepted, show modal immediately and block access
  if (!tosAccepted) {
    return (
      <>
        {/* TOS Modal - cannot be closed without accepting */}
        <TermsOfServiceModal
          isOpen={true}
          onClose={undefined} // No close button - user must accept
          onAccept={handleAcceptTOS}
          accepting={accepting}
        />
        
        {/* Disable interaction with underlying content */}
        <div className="opacity-30 pointer-events-none">
          {children}
        </div>
      </>
    );
  }

  // TOS accepted, render children normally
  return <>{children}</>;
}

