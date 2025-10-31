import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/UI/Spinner';
import { TOSGate } from '@/components/Auth/TOSGate';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  console.log('🔵 ProtectedRoute: RENDER - loading=', loading, 'user=', user ? 'Authenticated' : 'Not authenticated');

  if (loading) {
    console.log('🔵 ProtectedRoute: Showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    console.log('🔵 ProtectedRoute: No user found, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  console.log('🔵 ProtectedRoute: User authenticated, checking TOS acceptance');
  
  // Wrap children in TOSGate to ensure TOS is accepted
  return (
    <TOSGate>
      {children}
    </TOSGate>
  );
}

