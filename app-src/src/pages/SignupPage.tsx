import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/Auth/AuthLayout';
import { SignupForm } from '@/components/Auth/SignupForm';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/UI/Spinner';

export function SignupPage() {
  console.log('SignupPage: Rendering');
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  console.log('SignupPage: loading=', loading, 'user=', user ? 'Authenticated' : 'Not authenticated');

  useEffect(() => {
    if (!loading && user) {
      console.log('SignupPage: User already authenticated, redirecting to dashboard');
      window.location.href = '/app/dashboard';
    }
  }, [user, loading, navigate]);

  if (loading) {
    console.log('SignupPage: Showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  console.log('SignupPage: Rendering signup form');
  return (
    <AuthLayout
      title="Create Account"
      subtitle="Sign up to get started"
    >
      <SignupForm />
    </AuthLayout>
  );
}

