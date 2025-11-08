import { supabase } from './client';

export interface SignUpData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  tosAcceptedAt?: string;
  tosVersion?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

/**
 * Sign up a new user with email and password
 * @param inviteToken Optional invitation token for auto-verification
 * @param firstName Optional first name for profile creation
 * @param lastName Optional last name for profile creation
 * @param tosAcceptedAt Optional TOS acceptance timestamp
 * @param tosVersion Optional TOS version
 */
export async function signUp({ email, password, inviteToken, firstName, lastName, tosAcceptedAt, tosVersion }: SignUpData & { inviteToken?: string }) {
  // Normalize email (trim and lowercase) to ensure consistency
  const normalizedEmail = email.toLowerCase().trim();
  
  // For invited users, use backend endpoint that creates user via Admin API
  // This prevents Supabase from sending confirmation emails
  if (inviteToken) {
    try {
      const response = await fetch('/api/users/create-invited-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invite_token: inviteToken,
          email: normalizedEmail,
          password: password,
          first_name: firstName,
          last_name: lastName,
          tos_accepted_at: tosAcceptedAt,
          tos_version: tosVersion,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create invited user:', errorData);
        throw new Error(errorData.error || 'Failed to create user account');
      }

      const result = await response.json();
      if (result.success) {
        console.log('Invited user created successfully, signing in...');
        // Sign the user in with their password to get a session
        const signInResult = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (signInResult.error) {
          console.error('Failed to sign in after user creation:', signInResult.error);
          throw new Error('Account created and verified, but failed to sign in. Please try logging in manually.');
        }

        // Return the sign-in result which includes the session
        return signInResult.data;
      } else {
        throw new Error(result.error || 'Failed to create user account');
      }
    } catch (err) {
      console.error('Error creating invited user:', err);
      throw err; // Re-throw so the form can handle the error
    }
  }
  
  // For regular signups, use standard Supabase signUp
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      // Use TokenHash approach to prevent email prefetching
      // The email template will construct a link to our verify page
      emailRedirectTo: `${window.location.origin}/app/verify-email`,
    },
  });

  if (error) {
    throw new Error(error.message);
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

