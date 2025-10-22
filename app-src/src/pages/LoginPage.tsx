import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/Auth/AuthLayout';
import { LoginForm } from '@/components/Auth/LoginForm';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/UI/Spinner';

export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      // Check if there's a return URL in sessionStorage (set when redirected from document access)
      const returnUrl = sessionStorage.getItem('auth_return_url');
      if (returnUrl) {
        sessionStorage.removeItem('auth_return_url');
        window.location.href = returnUrl;
      } else {
        navigate('/app/dashboard');
      }
    }
  }, [user, loading, navigate]);

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

