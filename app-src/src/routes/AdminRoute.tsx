import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Spinner } from '@/components/UI/Spinner';
import { ProtectedRoute } from './ProtectedRoute';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * AdminRoute - Route guard that only allows super admins and owner admins to access dashboard routes
 * Regular users (registered role only) are redirected to their profile page
 * This prevents the flash of restricted content before redirect
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { loading, isSuperAdmin, isOwnerAdmin, ownerGroups, needsApproval } = usePermissions();

  return (
    <ProtectedRoute>
      {(() => {
        // Show loading spinner while checking permissions
        if (loading) {
          return (
            <div className="min-h-screen flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          );
        }

        // Calculate admin access
        const hasAdminAccess = isSuperAdmin || (ownerGroups && ownerGroups.some(
          og => og.role === 'owner_admin'
        ));

        // If user needs approval, let them through to see the pending approval message
        if (needsApproval) {
          return <>{children}</>;
        }

        // If user doesn't have admin access, redirect to profile page
        if (!hasAdminAccess) {
          console.log('AdminRoute: User does not have admin access, redirecting to profile');
          return <Navigate to="/profile" replace />;
        }

        // User has admin access, render the children
        return <>{children}</>;
      })()}
    </ProtectedRoute>
  );
}

