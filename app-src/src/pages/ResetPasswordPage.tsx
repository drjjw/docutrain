import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/Auth/AuthLayout';
import { Input } from '@/components/UI/Input';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { supabase } from '@/lib/supabase/client';
import { getAuthErrorMessage } from '@/lib/utils/errors';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkRecoverySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // If there's a session, user can reset password
        if (session) {
          setValidating(false);
        } else {
          // Check if there's a hash in the URL (Supabase recovery token)
          const hash = window.location.hash;
          if (hash && hash.includes('access_token')) {
            // Supabase will handle this automatically when we call getSession
            // The token is in the URL hash, Supabase will process it
            setValidating(false);
          } else {
            setError('Invalid or expired reset link. Please request a new password reset.');
            setValidating(false);
          }
        }
      } catch (err) {
        setError('Failed to validate reset link. Please request a new password reset.');
        setValidating(false);
      }
    };

    checkRecoverySession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setError(null);

    // Validation
    if (!password || !confirmPassword) {
      setError('Please enter both password fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      // Update password - Supabase will use the recovery token from the URL
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(getAuthErrorMessage(updateError));
        setLoading(false);
        return;
      }

      setSuccess(true);
      setPassword('');
      setConfirmPassword('');

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <AuthLayout title="Validating Reset Link" subtitle="Please wait...">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout title="Password Reset Successful" subtitle="Your password has been updated">
        <Alert variant="success">
          Your password has been successfully reset! Redirecting to login page...
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your new password"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Input
          label="New Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
        />

        <Input
          label="Confirm New Password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
        />

        <Button
          type="submit"
          className="w-full"
          loading={loading}
        >
          Reset Password
        </Button>
      </form>

      <div className="text-center text-sm text-gray-600 mt-4">
        Remember your password?{' '}
        <button
          onClick={() => navigate('/login')}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Sign in
        </button>
      </div>
    </AuthLayout>
  );
}

