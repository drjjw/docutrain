import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { docutrainLogoUrl } from '@/assets';

export function DashboardHeader() {
  const { signOut } = useAuth();
  const { isSuperAdmin, isOwnerAdmin } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Check if user has admin access (super admin or owner admin)
  const hasAdminAccess = isSuperAdmin || isOwnerAdmin;

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  const isDashboard = location.pathname === '/dashboard' || location.pathname.startsWith('/admin');
  const isUsers = location.pathname === '/users';
  const isProfile = location.pathname === '/profile';
  const isContact = location.pathname === '/contact';

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const NavLink = ({ 
    path, 
    icon, 
    label, 
    isActive, 
    onClick 
  }: { 
    path: string; 
    icon: React.ReactNode; 
    label: string; 
    isActive: boolean; 
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-3 w-full px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${
        isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      <span className={`flex-shrink-0 transition-colors ${
        isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
      }`}>
        {icon}
      </span>
      <span className="font-medium">{label}</span>
      {isActive && (
        <span className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
      )}
    </button>
  );

  return (
    <>
      <header className="bg-white border-b border-gray-200/60 shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-white/95">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              aria-label="Go to home"
            >
              <img
                src={docutrainLogoUrl}
                alt="DocuTrain Logo"
                className="h-14 w-auto"
              />
            </button>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {/* Only show Dashboard link to admins (super_admin or owner_admin) */}
              {hasAdminAccess && (
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                    isDashboard
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isDashboard ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="font-medium">Dashboard</span>
                </button>
              )}
              
              {isSuperAdmin && (
                <button
                  onClick={() => navigate('/users')}
                  className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                    isUsers
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isUsers ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="font-medium">Users</span>
                </button>
              )}
              
              <button
                onClick={() => navigate('/profile')}
                className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  isProfile
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  isProfile ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="font-medium">Profile</span>
              </button>
              
              <button
                onClick={() => navigate('/contact')}
                className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  isContact
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  isContact ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">Contact</span>
              </button>
              
              <div className="w-px h-8 bg-gray-200 mx-2" />
              
              <button
                onClick={handleSignOut}
                className="group flex items-center gap-2.5 px-4 py-2.5 rounded-lg font-medium text-sm text-gray-600 hover:text-gray-900 hover:bg-red-50 transition-all duration-200 whitespace-nowrap"
              >
                <svg className="w-4 h-4 flex-shrink-0 text-gray-500 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="font-medium">Sign Out</span>
              </button>
            </nav>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Mobile Menu Panel */}
          <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-xl z-50 md:hidden transform transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <button
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  aria-label="Go to home"
                >
                  <img
                    src={docutrainLogoUrl}
                    alt="DocuTrain Logo"
                    className="h-10 w-auto"
                  />
                </button>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                {/* Only show Dashboard link to admins (super_admin or owner_admin) */}
                {hasAdminAccess && (
                  <NavLink
                    path="/dashboard"
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    }
                    label="Dashboard"
                    isActive={isDashboard}
                    onClick={() => handleNavigation('/dashboard')}
                  />
                )}
                
                {isSuperAdmin && (
                  <NavLink
                    path="/users"
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    }
                    label="Users"
                    isActive={isUsers}
                    onClick={() => handleNavigation('/users')}
                  />
                )}
                
                <NavLink
                  path="/profile"
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                  label="Profile"
                  isActive={isProfile}
                  onClick={() => handleNavigation('/profile')}
                />
                
                <NavLink
                  path="/contact"
                  icon={
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  }
                  label="Contact"
                  isActive={isContact}
                  onClick={() => handleNavigation('/contact')}
                />
              </nav>

              {/* Sign Out Button */}
              <div className="border-t border-gray-200 p-4">
                <button
                  onClick={handleSignOut}
                  className="group flex items-center gap-3 w-full px-4 py-3 rounded-lg font-medium text-sm text-gray-700 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                >
                  <svg className="w-5 h-5 text-gray-500 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

