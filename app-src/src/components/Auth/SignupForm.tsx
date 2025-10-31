import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/UI/Input';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { useAuth } from '@/hooks/useAuth';
import { validateEmail, validatePassword, validatePasswordMatch } from '@/lib/utils/validation';
import { TermsOfServiceModal } from './TermsOfServiceModal';
import { acceptTermsOfService } from '@/lib/supabase/database';
import { supabase } from '@/lib/supabase/client';

export function SignupForm() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showTosModal, setShowTosModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleAcceptTos = () => {
    setTosAccepted(true);
    setShowTosModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!validatePasswordMatch(password, confirmPassword)) {
      setError('Passwords do not match');
      return;
    }

    if (!tosAccepted) {
      setError('You must accept the Terms of Service to continue');
      return;
    }

    try {
      setLoading(true);
      console.log('SignupForm: Attempting signup with email:', email);
      
      // Signup user first
      await signUp(email, password);
      console.log('SignupForm: Signup successful');
      
      // Get the current user after signup
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Record TOS acceptance - this is required, so if it fails we should log an error
      // The TOSGate will catch users who don't have TOS recorded when they log in
      if (currentUser?.id) {
        try {
          await acceptTermsOfService(currentUser.id, '2025-10-31');
          console.log('SignupForm: TOS acceptance recorded');
        } catch (tosError) {
          console.error('SignupForm: Failed to record TOS acceptance:', tosError);
          // Note: We don't block signup here because:
          // 1. The user has already been created in auth.users
          // 2. The TOSGate component will require TOS acceptance on first login
          // 3. This prevents orphaned auth users if TOS recording fails
          setError('Account created, but Terms of Service recording failed. You will be asked to accept TOS on first login.');
        }
      } else {
        console.error('SignupForm: No user ID after signup');
        setError('Account created but unable to retrieve user information. Please try logging in.');
      }
      
      // Show success message instead of redirecting
      // User needs to confirm email before they can log in
      setSignupEmail(email);
      setSignupSuccess(true);
    } catch (err) {
      console.error('SignupForm: Signup failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  // Show success message after signup
  if (signupSuccess) {
    return (
      <>
        <Alert variant="success">
          <div className="space-y-3">
            <p className="font-medium">Account created successfully!</p>
            <p className="text-sm">
              We've sent a confirmation email to <strong>{signupEmail}</strong>. 
              Please check your inbox and click the confirmation link to activate your account.
            </p>
            <p className="text-sm">
              After confirming your email, you'll be able to sign in and access your account.
            </p>
            <div className="pt-2 border-t border-green-200">
              <Link to="/login">
                <Button className="w-full">
                  Go to Sign In
                </Button>
              </Link>
            </div>
          </div>
        </Alert>
        
        <div className="text-center text-sm text-gray-600 mt-4">
          Didn't receive the email? Check your spam folder or{' '}
          <button
            onClick={() => setSignupSuccess(false)}
            className="text-blue-600 hover:text-blue-700 font-medium underline"
          >
            try signing up again
          </button>
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

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="new-password"
            helperText="At least 6 characters"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
            style={{ top: 'calc(1.25rem + 0.25rem + 0.5rem)' }}
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        <div className="relative">
          <Input
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 bottom-2.5 text-gray-400 hover:text-gray-600 focus:outline-none"
            tabIndex={-1}
          >
            {showConfirmPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-start space-x-2">
          <input
            type="checkbox"
            id="tos-acceptance"
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
            disabled={loading}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="tos-acceptance" className="text-sm text-gray-700">
            I agree to the{' '}
            <button
              type="button"
              onClick={() => setShowTosModal(true)}
              className="text-blue-600 hover:text-blue-700 underline"
            >
              Terms of Service
            </button>
          </label>
        </div>

        <Button
          type="submit"
          className="w-full"
          loading={loading}
        >
          Sign Up
        </Button>
      </form>

      <div className="text-center text-sm text-gray-600 mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
          Sign in
        </Link>
      </div>

      <TermsOfServiceModal
        isOpen={showTosModal}
        onClose={() => setShowTosModal(false)}
        onAccept={handleAcceptTos}
      />
    </>
  );
}

