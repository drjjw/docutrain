import { supabase } from './client';

export interface SignUpData {
  email: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Sign up a new user with email and password
 * @param inviteToken Optional invitation token for auto-verification
 */
export async function signUp({ email, password, inviteToken }: SignUpData & { inviteToken?: string }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Use TokenHash approach to prevent email prefetching
      // The email template will construct a link to our verify page
      emailRedirectTo: `${window.location.origin}/app/verify-email`,
      // If invite token is present, we'll handle verification via backend
      data: inviteToken ? { invite_token: inviteToken } : undefined,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  // If invite token is present, call backend to auto-verify and add to owner group
  if (inviteToken && data.user) {
    try {
      const response = await fetch('/api/users/complete-invite-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: data.user.id,
          invite_token: inviteToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to complete invite signup:', errorData);
        throw new Error(errorData.error || 'Failed to complete invite signup');
      }

      const result = await response.json();
      if (result.success) {
        console.log('Invite signup completed successfully, signing user in...');
        // Sign the user in with their password to get a session
        // This works because email is now confirmed
        const signInResult = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInResult.error) {
          console.error('Failed to sign in after invite signup:', signInResult.error);
          throw new Error('Account created and verified, but failed to sign in. Please try logging in manually.');
        }

        // Return the sign-in result which includes the session
        return signInResult.data;
      }
    } catch (err) {
      console.error('Error completing invite signup:', err);
      throw err; // Re-throw so the form can handle the error
    }
  }

  return data;
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn({ email, password }: SignInData) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.warn('Supabase signOut error (will clear local storage anyway):', error);
    }
  } catch (error) {
    console.warn('Supabase signOut exception (will clear local storage anyway):', error);
  }
  
  // Always clear local storage, even if Supabase signOut failed
  // This handles cases where the session is already expired/invalid
  // Clear all possible Supabase auth keys
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sb-')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Also clear session storage
  sessionStorage.clear();
  
  // Clear any passcode keys from localStorage
  const passcodeKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('passcode:')) {
      passcodeKeys.push(key);
    }
  }
  passcodeKeys.forEach(key => localStorage.removeItem(key));
  
  console.log('🟡 Cleared local/session storage keys:', keysToRemove);
  console.log('🟡 Cleared passcode keys:', passcodeKeys);
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  return user;
}

/**
 * Get the current session
 */
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return session;
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/app/reset-password`,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

