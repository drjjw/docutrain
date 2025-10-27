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

  useEffect(() => {
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
    if (!loading && user && !redirecting) {
      setRedirecting(true);

      // Clear owner info from sessionStorage after login
      sessionStorage.removeItem('auth_owner_info');

      // Check if there's a return URL in sessionStorage (set when redirected from document access)
      const returnUrl = sessionStorage.getItem('auth_return_url');
      if (returnUrl) {
        sessionStorage.removeItem('auth_return_url');
        window.location.href = returnUrl;
        return;
      }

      // Fetch user permissions to determine redirect destination
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          console.error('No active session found');
          window.location.href = '/app/dashboard';
          return;
        }

        fetch('/api/permissions', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        })
        .then(response => response.json())
        .then(data => {
          if (data.is_super_admin) {
            // SuperAdmins go to dashboard for admin functions
            window.location.href = '/app/dashboard';
          } else if (data.owner_groups && data.owner_groups.length > 0) {
            // Regular users go to their primary owner group
            const primaryOwner = data.owner_groups[0];
            window.location.href = `/?owner=${primaryOwner.owner_slug}`;
          } else {
            // Fallback to dashboard if no owner groups
            window.location.href = '/app/dashboard';
          }
        })
        .catch(error => {
          console.error('Failed to fetch user permissions:', error);
          // Fallback to dashboard on error
          window.location.href = '/app/dashboard';
        });
      }).catch(error => {
        console.error('Failed to get session:', error);
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

  const title = ownerInfo ? `Welcome to ${ownerInfo.name}` : "Welcome Back";
  const subtitle = ownerInfo ? "Sign in to access restricted content" : "Sign in to your account";

  return (
    <AuthLayout
      title={title}
      subtitle={subtitle}
      ownerInfo={ownerInfo}
    >
      <LoginForm />
    </AuthLayout>
  );
}

