import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/Auth/AuthLayout';
import { LoginForm } from '@/components/Auth/LoginForm';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/UI/Spinner';
import { Alert } from '@/components/UI/Alert';
import { supabase } from '@/lib/supabase/client';

interface OwnerInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
}

export function LoginPage() {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    // Check for OTP expiration or other verification errors in URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = hashParams.get('error');
    const errorCode = hashParams.get('error_code');
    
    if (error && errorCode === 'otp_expired') {
      setVerificationError('This verification link has expired. Please request a new confirmation email by signing up again.');
      // Clear the error from URL
      window.history.replaceState({}, '', '/app/login');
    } else if (error) {
      const errorDescription = hashParams.get('error_description') || error;
      setVerificationError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
      // Clear the error from URL
      window.history.replaceState({}, '', '/app/login');
    }

    // Check if user was just logged out
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === 'true') {
      setShowLogoutMessage(true);
      // Clear the logout parameter from URL after 5 seconds
      setTimeout(() => {
        setShowLogoutMessage(false);
        window.history.replaceState({}, '', '/app/login');
      }, 5000);
    }

    // Check for email verification success
    // Supabase may include token or type parameters in the URL
    const urlSearchParams = new URLSearchParams(window.location.search);
    const hashParamsForToken = new URLSearchParams(window.location.hash.substring(1));
    const hasToken = urlSearchParams.get('token') || hashParamsForToken.get('access_token');
    const isSignupType = urlSearchParams.get('type') === 'signup' || hashParamsForToken.get('type') === 'signup';
    
    // Check for returnUrl in URL query params and store in sessionStorage
    const returnUrlParam = urlSearchParams.get('returnUrl');
    
    // Check if we've already stored it (to prevent re-storing on re-renders)
    const alreadyStored = sessionStorage.getItem('auth_return_url');
    
    if (returnUrlParam) {
      // Decode and store in sessionStorage for use after login
      const decodedUrl = decodeURIComponent(returnUrlParam);
      sessionStorage.setItem('auth_return_url', decodedUrl);
      // Remove returnUrl from URL to keep it clean (only if we just stored it)
      if (!alreadyStored) {
        urlSearchParams.delete('returnUrl');
        const newUrl = window.location.pathname + (urlSearchParams.toString() ? '?' + urlSearchParams.toString() : '') + window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }
    }
    
    // Check if we have a session (user just confirmed email)
    // If user has a session and there's a token/type=signup, they just verified
    if (!loading && session && user && (hasToken || isSignupType)) {
      // Check if this is a newly confirmed email (email_confirmed_at exists)
      const emailConfirmed = user.email_confirmed_at !== null && user.email_confirmed_at !== undefined;
      
      if (emailConfirmed) {
        setShowVerificationSuccess(true);
        // Clear URL parameters
        const cleanUrl = window.location.pathname + window.location.hash.split('?')[0];
        window.history.replaceState({}, '', cleanUrl);
        // Auto-redirect after showing success message
        setTimeout(() => {
          if (session) {
            navigate('/dashboard');
          }
        }, 3000);
      }
    }

    // Check for owner info in sessionStorage (set when redirected from restricted document)
    const storedOwnerInfo = sessionStorage.getItem('auth_owner_info');
    if (storedOwnerInfo) {
      try {
        const parsedOwnerInfo = JSON.parse(storedOwnerInfo);
        setOwnerInfo(parsedOwnerInfo);
      } catch (error) {
        console.error('Failed to parse owner info from sessionStorage:', error);
      }
    }
  }, [session, loading, navigate]);

  useEffect(() => {
    console.log('🟣 LoginPage: useEffect - loading:', loading, 'user:', !!user, 'session:', !!session, 'redirecting:', redirecting);
    
    // Don't auto-redirect if we're showing verification success message
    if (showVerificationSuccess) {
      return;
    }
    
    if (!loading && user && session && !redirecting) {
      console.log('🟣 LoginPage: User is authenticated, preparing to redirect...');
      setRedirecting(true);

      // Clear owner info from sessionStorage after login
      sessionStorage.removeItem('auth_owner_info');

      // Check if there's a return URL in sessionStorage (set when redirected from document access)
      const returnUrl = sessionStorage.getItem('auth_return_url');
      if (returnUrl) {
        sessionStorage.removeItem('auth_return_url');
        // Ensure returnUrl has /app prefix for full URL navigation
        const fullUrl = returnUrl.startsWith('/app/') ? returnUrl : `/app${returnUrl}`;
        window.location.href = fullUrl;
        return;
      }

      // Fetch user permissions to determine redirect destination
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          console.error('LoginPage: No active session found after user check');
          window.location.href = '/app/dashboard';
          return;
        }

        console.log('LoginPage: Fetching user permissions...');
        fetch('/api/permissions', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })
        .then(response => response.json())
        .then(data => {
          console.log('LoginPage: Permissions received:', data);
          // Only redirect to dashboard if no returnUrl was set
          // This allows users to return to the page they were trying to access
          if (data.is_super_admin) {
            // SuperAdmins go to dashboard for admin functions (unless returnUrl was set)
            console.log('LoginPage: Redirecting super admin to dashboard');
            window.location.href = '/app/dashboard';
          } else if (data.owner_groups && data.owner_groups.length > 0) {
            // Regular users go to their primary owner group
            const primaryOwner = data.owner_groups[0];
            console.log('LoginPage: Redirecting to owner:', primaryOwner.owner_slug);
            window.location.href = `/?owner=${primaryOwner.owner_slug}`;
          } else {
            // Fallback to dashboard if no owner groups
            console.log('LoginPage: No owner groups, redirecting to dashboard');
            window.location.href = '/app/dashboard';
          }
        })
        .catch(error => {
          console.error('LoginPage: Failed to fetch user permissions:', error);
          // Fallback to dashboard on error
          window.location.href = '/app/dashboard';
        });
      }).catch(error => {
        console.error('LoginPage: Failed to get session:', error);
        window.location.href = '/app/dashboard';
      });
    }
  }, [user, session, loading, navigate, redirecting, showVerificationSuccess]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Determine title and subtitle based on context
  let title = "Welcome Back";
  let subtitle = "Sign in to your account";
  
  if (showLogoutMessage) {
    title = "Successfully Signed Out";
    subtitle = "Thanks for using DocuTrain! Sign in again when you're ready.";
  } else if (ownerInfo) {
    title = `Welcome to ${ownerInfo.name}`;
    subtitle = "Sign in to access restricted content";
  }

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      ownerInfo={ownerInfo}
    >
      {verificationError && (
        <Alert variant="error" onDismiss={() => setVerificationError(null)}>
          <div>
            <p className="font-medium mb-1">Verification Link Expired</p>
            <p className="text-sm">{verificationError}</p>
            <p className="text-sm mt-2">
              To get a new verification email, please{' '}
              <Link to="/signup" className="text-blue-600 hover:text-blue-700 underline font-medium">
                sign up again
              </Link>
              {' '}with the same email address.
            </p>
          </div>
        </Alert>
      )}
      {showVerificationSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-800 mb-1">
                Email verified successfully!
              </p>
              <p className="text-sm text-green-700">
                Your account has been activated. You'll be redirected to the dashboard shortly, or you can sign in now.
              </p>
            </div>
          </div>
        </div>
      )}
      {showLogoutMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium text-green-800">
              Your session has been securely ended. All data has been cleared.
            </p>
          </div>
        </div>
      )}
      <LoginForm />
    </AuthLayout>
  );
}

