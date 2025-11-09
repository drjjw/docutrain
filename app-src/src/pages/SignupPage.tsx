import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/Auth/AuthLayout';
import { SignupForm } from '@/components/Auth/SignupForm';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/UI/Spinner';
import { debugLog } from '@/utils/debug';

export function SignupPage() {
  debugLog('SignupPage: Rendering');
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();

  debugLog('SignupPage: loading=', loading, 'user=', user ? 'Authenticated' : 'Not authenticated', 'session=', session ? 'Has session' : 'No session');

  useEffect(() => {
    // Only redirect if user has a valid session (email confirmed)
    // If user exists but no session, email isn't confirmed yet - show signup form
    if (!loading && user && session) {
      debugLog('SignupPage: User already authenticated with confirmed email, redirecting to dashboard');
      window.location.href = '/app/dashboard';
    }
  }, [user, session, loading, navigate]);

  if (loading) {
    debugLog('SignupPage: Showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  debugLog('SignupPage: Rendering signup form');
  return (
    <AuthLayout
      title="Create Account"
      subtitle="Sign up to get started"
    >
      <SignupForm />
    </AuthLayout>
  );
}

