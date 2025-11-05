import React, { createContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import * as authService from '@/lib/supabase/auth';
import type { AuthContextType } from '@/types/auth';
import { getAuthErrorMessage } from '@/lib/utils/errors';

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('AuthProvider: Initializing...');
    // Get initial session
    authService.getSession().then((session) => {
      console.log('AuthProvider: Session loaded', session ? 'Authenticated' : 'Not authenticated');
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('AuthProvider: Failed to load session', error);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🟢 AuthContext: onAuthStateChange triggered', { event: _event, hasSession: !!session });
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await authService.signIn({ email, password });
      setSession(data.session);
      setUser(data.user);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error as Error));
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log('AuthContext: signUp called for', email);
      const data = await authService.signUp({ email, password });
      console.log('AuthContext: signUp response:', { 
        hasSession: !!data.session, 
        hasUser: !!data.user,
        user: data.user
      });
      // Only set session/user if there's a valid session (email confirmed)
      // If email confirmation is required, session will be null and we shouldn't set user
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      } else {
        // No session means email confirmation required - clear any existing user
        setSession(null);
        setUser(null);
      }
      // Return the signup data so the form can use it
      return data;
    } catch (error) {
      console.error('AuthContext: signUp error:', error);
      throw new Error(getAuthErrorMessage(error as Error));
    }
  };

  const signOut = async () => {
    console.log('🟡 AuthContext: signOut called');
    try {
      await authService.signOut();
      console.log('🟡 AuthContext: authService.signOut completed');
    } catch (error) {
      console.error('🔴 AuthContext: signOut error (will clear local state anyway):', error);
      // Don't throw - we still want to clear local state even if Supabase signOut fails
    }
    
    // Always clear local state, even if Supabase signOut failed
    setSession(null);
    setUser(null);
    console.log('🟡 AuthContext: Session and user cleared locally');
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

