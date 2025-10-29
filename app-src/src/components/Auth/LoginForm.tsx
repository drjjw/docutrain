import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/UI/Input';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { useAuth } from '@/hooks/useAuth';
import { validateEmail } from '@/lib/utils/validation';
import { resetPassword } from '@/lib/supabase/auth';

export function LoginForm() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(null);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (loading) return;

    setError(null);
    setLoading(true);

    // Validation
    if (!email || !password) {
      setError('Please enter both email and password');
      setLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      await signIn(email, password);
      window.location.href = '/app/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (forgotPasswordLoading) return;

    setForgotPasswordError(null);
    setForgotPasswordSuccess(false);

    if (!forgotPasswordEmail) {
      setForgotPasswordError('Please enter your email address');
      return;
    }

    if (!validateEmail(forgotPasswordEmail)) {
      setForgotPasswordError('Please enter a valid email address');
      return;
    }

    setForgotPasswordLoading(true);

    try {
      await resetPassword(forgotPasswordEmail);
      setForgotPasswordSuccess(true);
      setForgotPasswordError(null);
    } catch (err) {
      setForgotPasswordError(err instanceof Error ? err.message : 'Failed to send reset email');
      setForgotPasswordSuccess(false);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <>
        <div className="space-y-4">
          {forgotPasswordSuccess && (
            <Alert variant="success" onDismiss={() => setForgotPasswordSuccess(false)}>
              Password reset email sent! Please check your inbox and follow the instructions to reset your password.
            </Alert>
          )}

          {forgotPasswordError && (
            <Alert variant="error" onDismiss={() => setForgotPasswordError(null)}>
              {forgotPasswordError}
            </Alert>
          )}

          {!forgotPasswordSuccess && (
            <>
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Reset Password</h3>
                <p className="text-sm text-gray-600">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  disabled={forgotPasswordLoading}
                  autoComplete="email"
                />

                <Button
                  type="submit"
                  className="w-full"
                  loading={forgotPasswordLoading}
                >
                  Send Reset Link
                </Button>
              </form>
            </>
          )}

          <div className="text-center text-sm text-gray-600 mt-4">
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setForgotPasswordEmail('');
                setForgotPasswordError(null);
                setForgotPasswordSuccess(false);
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
        />

        <div>
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          loading={loading}
        >
          Sign In
        </Button>
      </form>

      <div className="text-center text-sm text-gray-600 mt-4">
        Don't have an account?{' '}
        <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
          Sign up
        </Link>
      </div>
    </>
  );
}

