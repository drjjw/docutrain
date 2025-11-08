import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/Auth/AuthLayout';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { Spinner } from '@/components/UI/Spinner';
import { supabase } from '@/lib/supabase/client';
import { getAuthErrorMessage } from '@/lib/utils/errors';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get token_hash and type from URL parameters
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const redirectTo = searchParams.get('redirect_to');

  useEffect(() => {
    // If no token_hash, show error
    if (!tokenHash || !type) {
      setError('Invalid verification link. Please check your email and try again.');
      setVerifying(false);
    }
  }, [tokenHash, type]);

  const handleVerify = async () => {
    // Prevent double-clicks
    if (verifying) {
      return;
    }

    if (!tokenHash || !type) {
      setError('Invalid verification link.');
      return;
    }

    setVerifying(true);
    setError(null);
    setSuccess(false);

    try {
      // Verify the OTP token
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'signup' | 'email' | 'recovery' | 'email_change',
      });

      if (verifyError) {
        throw verifyError;
      }

      if (data.session) {
        setSuccess(true);
        // Redirect after 2 seconds
        setTimeout(() => {
          if (redirectTo) {
            window.location.href = redirectTo;
          } else {
            navigate('/dashboard');
          }
        }, 2000);
      } else {
        setError('Verification failed. Please try again or request a new confirmation email.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify email';
      
      // Check if it's an expired token error
      if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        setError('This verification link has expired or is invalid. Please request a new confirmation email by signing up again.');
      } else {
        setError(getAuthErrorMessage(errorMessage));
      }
    } finally {
      setVerifying(false);
    }
  };

  if (!tokenHash || !type) {
    return (
      <AuthLayout
        title="Invalid Link"
        subtitle="The verification link is invalid"
      >
        <Alert variant="error">
          {error || 'Invalid verification link. Please check your email and try again.'}
        </Alert>
        <div className="mt-4 text-center">
          <Button onClick={() => navigate('/signup')}>
            Go to Sign Up
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout
        title="Email Verified!"
        subtitle="Your account has been activated"
      >
        <Alert variant="success">
          <div className="space-y-2">
            <p className="font-medium">Email verified successfully!</p>
            <p className="text-sm">Your account has been activated. Redirecting you now...</p>
          </div>
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Confirm Your Email"
      subtitle="Click the button below to verify your email address"
    >
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Security Notice:</strong> Click the button below to verify your email address. 
            This helps protect against email prefetching by security services.
          </p>
        </div>

        <Button
          onClick={handleVerify}
          className="w-full"
          loading={verifying}
          disabled={verifying || !tokenHash}
        >
          {verifying ? 'Verifying...' : 'Verify Email Address'}
        </Button>

        <div className="text-center text-sm text-gray-600">
          Didn't receive the email?{' '}
          <button
            onClick={() => navigate('/signup')}
            className="text-blue-600 hover:text-blue-700 font-medium underline"
          >
            Sign up again
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}

