import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/UI/Button';

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { isSuperAdmin, ownerGroups } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const hasAdminAccess = isSuperAdmin || (ownerGroups && ownerGroups.some(
    og => og.role === 'owner_admin'
  ));

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">
              {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Navigation Links */}
            <Button
              variant={location.pathname === '/dashboard' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              Home
            </Button>
            {hasAdminAccess && (
              <Button
                variant={location.pathname.startsWith('/admin') ? 'primary' : 'outline'}
                size="sm"
                onClick={() => navigate('/admin/documents')}
              >
                Admin
              </Button>
            )}
            <Button
              variant={location.pathname === '/profile' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => navigate('/profile')}
            >
              Profile
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

