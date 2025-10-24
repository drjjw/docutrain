import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/UI/Button';
import { getAccessibleOwners } from '@/lib/supabase/permissions';

export function DashboardHeader() {
  const { user, signOut } = useAuth();
  const { isSuperAdmin, ownerGroups } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [ownerLogoUrl, setOwnerLogoUrl] = useState<string | null>(null);

  const hasAdminAccess = isSuperAdmin || (ownerGroups && ownerGroups.some(
    og => og.role === 'owner_admin'
  ));

  // Fetch owner logo for all users with owner groups (except super admins)
  useEffect(() => {
    const fetchOwnerLogo = async () => {
      if (!user || isSuperAdmin || ownerGroups.length === 0) {
        setOwnerLogoUrl(null);
        return;
      }

      try {
        const owners = await getAccessibleOwners(user.id);
        if (owners.length > 0 && owners[0].logo_url) {
          setOwnerLogoUrl(owners[0].logo_url);
        }
      } catch (error) {
        console.error('Failed to fetch owner logo:', error);
      }
    };

    fetchOwnerLogo();
  }, [user?.id, isSuperAdmin, ownerGroups.length]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {ownerLogoUrl ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200">
                <img 
                  src={ownerLogoUrl} 
                  alt="Owner logo" 
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                {user?.email?.substring(0, 2).toUpperCase() || '?'}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Portal</h1>
              <p className="text-xs text-gray-600">
                {user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Navigation Links */}
            <Button
              variant={location.pathname === '/dashboard' || location.pathname.startsWith('/admin') ? 'primary' : 'outline'}
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="whitespace-nowrap px-5"
            >
              <svg className="w-4 h-4 mr-1.5 flex-shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Button>
            {isSuperAdmin && (
              <Button
                variant={location.pathname === '/users' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => navigate('/users')}
                className="whitespace-nowrap px-5"
              >
                <svg className="w-4 h-4 mr-1.5 flex-shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Users
              </Button>
            )}
            <Button
              variant={location.pathname === '/profile' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => navigate('/profile')}
              className="whitespace-nowrap px-5"
            >
              <svg className="w-4 h-4 mr-1.5 flex-shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile
            </Button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
              className="whitespace-nowrap px-5"
            >
              <svg className="w-4 h-4 mr-1.5 flex-shrink-0 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

