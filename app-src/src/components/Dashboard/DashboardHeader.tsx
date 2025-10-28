import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/UI/Button';
import { docutrainLogoUrl } from '@/assets';

export function DashboardHeader() {
  const { signOut } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    console.log('🔴 DashboardHeader: handleSignOut called');
    console.log('🔴 DashboardHeader: Calling signOut...');
    await signOut();
    console.log('🔴 DashboardHeader: signOut completed successfully');
    
    // Small delay to ensure state propagation, then force full page reload to login with logout message
    setTimeout(() => {
      console.log('🔴 DashboardHeader: Force navigating to login');
      window.location.href = '/app/login?logout=true';
    }, 100);
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <img
            src={docutrainLogoUrl}
            alt="DocuTrain Logo"
            className="w-[250px]"
          />
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

