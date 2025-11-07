import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/UI/Input';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { useAuth } from '@/hooks/useAuth';
import { validateEmail, validatePassword, validatePasswordMatch } from '@/lib/utils/validation';
import { TermsOfServiceModal } from './TermsOfServiceModal';
import { supabase } from '@/lib/supabase/client';

export function SignupForm() {
  const { signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite_token');
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
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
  const [inviteInfo, setInviteInfo] = useState<{ email: string; ownerName: string } | null>(null);
  const [validatingInvite, setValidatingInvite] = useState(false);

  // Validate invite token and fetch invitation details
  useEffect(() => {
    if (inviteToken) {
      setValidatingInvite(true);
      // Call backend to validate token and get invitation details
      fetch(`/api/users/validate-invite?token=${encodeURIComponent(inviteToken)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.invitation) {
            setInviteInfo({
              email: data.invitation.email,
              ownerName: data.invitation.owner_name,
            });
            setEmail(data.invitation.email);
          } else {
            setError(data.error || 'Invalid or expired invitation link');
          }
        })
        .catch(err => {
          console.error('Failed to validate invitation:', err);
          setError('Failed to validate invitation. Please check your link and try again.');
        })
        .finally(() => {
          setValidatingInvite(false);
        });
    }
  }, [inviteToken]);

  const handleAcceptTos = () => {
    setTosAccepted(true);
    setShowTosModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
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
      
      // Signup user first - pass invite_token if present
      const signupResult = await signUp(email, password, inviteToken || undefined);
      console.log('SignupForm: Signup successful', signupResult);
      
      if (!signupResult) {
        console.error('SignupForm: signUp returned undefined');
        setError('Account created but unable to retrieve signup information. Please try logging in.');
        setSignupEmail(email);
        setSignupSuccess(true);
        return;
      }
      
      // Get the session from signup result first, then fall back to getSession()
      // When email confirmation is required, signupResult.session might be null
      let session = signupResult.session;
      if (!session) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        session = currentSession;
      }
      
      // Record user profile with name and TOS acceptance
      // Try authenticated endpoint first (if session exists), otherwise use signup-profile endpoint
      const userId = signupResult.user?.id;
      if (!userId) {
        console.error('SignupForm: No user ID after signup');
        setError('Account created but unable to retrieve user information. Please try logging in.');
        setSignupEmail(email);
        setSignupSuccess(true);
        return;
      }

      try {
        let response;
        
        if (session?.access_token) {
          // Use authenticated endpoint if session exists
          response = await fetch('/api/users/me/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              tos_accepted_at: new Date().toISOString(),
              tos_version: '2025-10-31',
            }),
          });
        } else {
          // Use signup-profile endpoint when no session (email confirmation required)
          response = await fetch('/api/users/signup-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: userId,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              tos_accepted_at: new Date().toISOString(),
              tos_version: '2025-10-31',
            }),
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create profile');
        }

        console.log('SignupForm: User profile created with name and TOS acceptance');
      } catch (profileError) {
        console.error('SignupForm: Failed to create user profile:', profileError);
        // Note: We don't block signup here because:
        // 1. The user has already been created in auth.users
        // 2. The TOSGate component will require TOS acceptance on first login
        // 3. This prevents orphaned auth users if profile creation fails
        setError('Account created, but profile setup failed. You will be asked to complete your profile on first login.');
      }
      
      // Show success message instead of redirecting
      // User needs to confirm email before they can log in
      // For invited users, they're already verified
      if (inviteToken) {
        // Invited users are auto-verified - redirect to dashboard
        setSignupEmail(email);
        setSignupSuccess(true);
        // Redirect after a short delay
        setTimeout(() => {
          window.location.href = '/app/dashboard';
        }, 2000);
      } else {
        setSignupEmail(email);
        setSignupSuccess(true);
      }
    } catch (err) {
      console.error('SignupForm: Signup failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  // Show success message after signup
  if (signupSuccess) {
    const isInvited = !!inviteToken;
    
    return (
      <>
        <Alert variant="success">
          <div className="space-y-3">
            <p className="font-medium">Account created successfully!</p>
            {isInvited ? (
              <>
                <p className="text-sm">
                  Your account has been created and verified. You've been added to <strong>{inviteInfo?.ownerName || 'the group'}</strong>.
                </p>
                <p className="text-sm">
                  Redirecting you to your dashboard...
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </Alert>
        
        {!isInvited && (
          <div className="text-center text-sm text-gray-600 mt-4">
            Didn't receive the email? Check your spam folder or{' '}
            <button
              onClick={() => setSignupSuccess(false)}
              className="text-blue-600 hover:text-blue-700 font-medium underline"
            >
              try signing up again
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {validatingInvite && (
        <div className="mb-4">
          <Alert variant="info">
            Validating invitation...
          </Alert>
        </div>
      )}
      
      {inviteInfo && (
        <div className="mb-4">
          <Alert variant="success">
            <div className="space-y-1">
              <p className="font-medium">You've been invited!</p>
              <p className="text-sm">
                You're joining <strong>{inviteInfo.ownerName}</strong>. Your account will be automatically verified and added to this group.
              </p>
            </div>
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name"
            type="text"
            placeholder="John"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={loading}
            autoComplete="given-name"
            required
          />
          <Input
            label="Last Name"
            type="text"
            placeholder="Doe"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={loading}
            autoComplete="family-name"
            required
          />
        </div>

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading || !!inviteInfo}
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

