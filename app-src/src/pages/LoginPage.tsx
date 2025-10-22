import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/Auth/AuthLayout';
import { LoginForm } from '@/components/Auth/LoginForm';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/UI/Spinner';
import { supabase } from '@/lib/supabase/client';

export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && user && !redirecting) {
      setRedirecting(true);

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
          navigate('/app/dashboard');
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
            navigate('/app/dashboard');
          } else if (data.owner_groups && data.owner_groups.length > 0) {
            // Regular users go to their primary owner group
            const primaryOwner = data.owner_groups[0];
            window.location.href = `/?owner=${primaryOwner.owner_slug}`;
          } else {
            // Fallback to dashboard if no owner groups
            navigate('/app/dashboard');
          }
        })
        .catch(error => {
          console.error('Failed to fetch user permissions:', error);
          // Fallback to dashboard on error
          navigate('/app/dashboard');
        });
      }).catch(error => {
        console.error('Failed to get session:', error);
        navigate('/app/dashboard');
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

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your account"
    >
      <LoginForm />
    </AuthLayout>
  );
}

