import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/Auth/AuthLayout';
import { LoginForm } from '@/components/Auth/LoginForm';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/UI/Spinner';
import { supabase } from '@/lib/supabase/client';

interface OwnerInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
}

export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    console.log('🟣 LoginPage: useEffect - loading:', loading, 'user:', !!user, 'redirecting:', redirecting);
    
    if (!loading && user && !redirecting) {
      console.log('🟣 LoginPage: User is authenticated, preparing to redirect...');
      setRedirecting(true);

      // Clear owner info from sessionStorage after login
      sessionStorage.removeItem('auth_owner_info');

      // Check if there's a return URL in sessionStorage (set when redirected from document access)
      const returnUrl = sessionStorage.getItem('auth_return_url');
      if (returnUrl) {
        console.log('LoginPage: Found return URL, redirecting to:', returnUrl);
        sessionStorage.removeItem('auth_return_url');
        window.location.href = returnUrl;
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
          if (data.is_super_admin) {
            // SuperAdmins go to dashboard for admin functions
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
  }, [user, loading, navigate, redirecting]);

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

