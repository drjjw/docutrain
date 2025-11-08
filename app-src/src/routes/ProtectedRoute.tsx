import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/UI/Spinner';
import { TOSGate } from '@/components/Auth/TOSGate';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

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
    // Capture the current pathname and search params (without /app prefix since router basename is /app)
    const currentPath = location.pathname || '/';
    const currentSearch = location.search || '';
    const currentUrl = currentPath + currentSearch;
    const returnUrl = encodeURIComponent(currentUrl);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  console.log('🔵 ProtectedRoute: User authenticated, checking TOS acceptance');
  
  // Wrap children in TOSGate to ensure TOS is accepted
  return (
    <TOSGate>
      {children}
    </TOSGate>
  );
}

