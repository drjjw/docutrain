import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { UploadZone } from '@/components/Upload/UploadZone';
import { DocumentsTable, DocumentsTableRef } from '@/components/Admin/DocumentsTable';
import { UserDocumentsTable, UserDocumentsTableRef } from '@/components/Admin/UserDocumentsTable';
import { UsersTable } from '@/components/Admin/UsersTable';
import { PermissionsBadge } from '@/components/Dashboard/PermissionsBadge';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert } from '@/components/UI/Alert';
import { Spinner } from '@/components/UI/Spinner';
import { getUserProfile } from '@/lib/supabase/database';

export function DashboardPage() {
  const { user } = useAuth();
  const { permissions, loading, isSuperAdmin, isOwnerAdmin, ownerGroups, needsApproval } = usePermissions();
  const [userProfile, setUserProfile] = useState<{ first_name?: string; last_name?: string } | null>(null);
  
  // Debug logging
  console.log('DashboardPage - ownerGroups:', ownerGroups);
  
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'documents' | 'users'>('documents');
  const userDocumentsTableRef = useRef<UserDocumentsTableRef>(null);
  const documentsTableRef = useRef<DocumentsTableRef>(null);
  const [hasActiveDocuments, setHasActiveDocuments] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevHasActiveRef = useRef<boolean>(false);

  const hasAdminAccess = isSuperAdmin || (ownerGroups && ownerGroups.some(
    og => og.role === 'owner_admin'
  ));

  // Redirect regular users (registered role only) to their owner chat interface
  React.useEffect(() => {
    if (!loading && !needsApproval && !hasAdminAccess && ownerGroups.length > 0) {
      // User is a regular registered user - redirect to their owner's chat
      const primaryOwner = ownerGroups[0];
      console.log('DashboardPage: Regular user detected, redirecting to chat:', primaryOwner.owner_slug);
      window.location.href = `/app/chat?owner=${primaryOwner.owner_slug}`;
    }
  }, [loading, needsApproval, hasAdminAccess, ownerGroups]);

  // Check for active documents on mount (after table has loaded)
  React.useEffect(() => {
    const checkActiveDocuments = () => {
      if (userDocumentsTableRef.current) {
        const hasActive = userDocumentsTableRef.current.hasActiveDocuments();
        setHasActiveDocuments(hasActive);
      }
    };

    // Check after a delay to ensure table component has loaded and ref is set
    const timeoutId = setTimeout(checkActiveDocuments, 2000);

    return () => clearTimeout(timeoutId);
  }, []); // Only run on mount

  // Handler for status changes from UserDocumentsTable
  const handleStatusChange = React.useCallback(() => {
    if (userDocumentsTableRef.current && documentsTableRef.current) {
      const hasActive = userDocumentsTableRef.current.hasActiveDocuments();
      const prevHasActive = prevHasActiveRef.current;
      prevHasActiveRef.current = hasActive;
      setHasActiveDocuments(hasActive);
      
      // Refresh DocumentsTable on any status change
      // This ensures the main documents table updates when processing completes
      console.log('📊 Status change detected:', { hasActive, prevHasActive });
      
      // Clear any pending refresh to debounce
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      // Delay refresh to ensure document is fully created in database
      refreshTimeoutRef.current = setTimeout(() => {
        console.log('🔄 Refreshing DocumentsTable after status change');
        documentsTableRef.current?.refresh();
      }, 1500);
    }
  }, []);

  // Set active tab based on current route
  React.useEffect(() => {
    if (location.pathname.includes('/users')) {
      setActiveTab('users');
    } else {
      setActiveTab('documents');
    }
  }, [location.pathname]);

  const handleTabChange = (tab: 'documents' | 'users') => {
    setActiveTab(tab);
    if (tab === 'users') {
      navigate('/users');
    } else {
      navigate('/dashboard');
    }
  };

  // Fetch user profile
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user?.id) {
        try {
          const profile = await getUserProfile(user.id);
          setUserProfile(profile);
        } catch (err) {
          console.error('Failed to load user profile:', err);
        }
      }
    };
    
    loadUserProfile();
  }, [user?.id]);

  // Get user display name (first + last name, or email as fallback)
  const getUserDisplayName = () => {
    if (userProfile?.first_name || userProfile?.last_name) {
      const firstName = userProfile.first_name || '';
      const lastName = userProfile.last_name || '';
      return `${firstName} ${lastName}`.trim();
    }
    return user?.email || 'User';
  };

  // Get user initials for avatar (prefer name initials, fallback to email)
  const getUserInitials = () => {
    if (userProfile?.first_name || userProfile?.last_name) {
      const firstName = userProfile.first_name || '';
      const lastName = userProfile.last_name || '';
      const firstInitial = firstName.charAt(0).toUpperCase();
      const lastInitial = lastName.charAt(0).toUpperCase();
      if (firstInitial && lastInitial) {
        return `${firstInitial}${lastInitial}`;
      }
      if (firstInitial) return firstInitial;
      if (lastInitial) return lastInitial;
    }
    // Fallback to email initials
    if (!user?.email) return '?';
    const email = user.email;
    return email.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 sm:p-8 hover:shadow-xl transition-shadow duration-300">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* User Avatar or Owner Logo */}
            {!isSuperAdmin && hasAdminAccess && ownerGroups.length > 0 && ownerGroups[0].owner_logo_url ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200/60 shadow-sm flex items-center justify-center flex-shrink-0 p-3 transition-transform duration-300 hover:scale-105">
                <img 
                  src={ownerGroups[0].owner_logo_url} 
                  alt={ownerGroups[0].owner_name} 
                  className="w-full h-full object-contain"
                  title={ownerGroups[0].owner_name}
                />
              </div>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-[#3399ff] to-[#65ccff] flex items-center justify-center text-xl sm:text-2xl font-bold text-white flex-shrink-0 shadow-lg shadow-[#3399ff]/30 transition-transform duration-300 hover:scale-105">
                {getUserInitials()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                Welcome back!
              </h1>
              <p className="text-base sm:text-lg text-gray-600 break-words font-medium mb-3">
                {getUserDisplayName()}
              </p>
              <div className="flex flex-wrap gap-3">
                {isSuperAdmin ? (
                  <PermissionsBadge role="super_admin" />
                ) : hasAdminAccess ? (
                  ownerGroups.map((og) => (
                    <PermissionsBadge
                      key={og.owner_id}
                      role={og.role}
                      ownerName={og.owner_name}
                    />
                  ))
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Only show if user has admin access */}
        {hasAdminAccess && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
            <nav className="flex space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 min-w-max">
              <button
                onClick={() => handleTabChange('documents')}
                className={`px-4 sm:px-6 py-3 rounded-lg font-semibold text-sm whitespace-nowrap transition-all duration-200 ${
                  activeTab === 'documents'
                    ? 'bg-[#3399ff] text-white shadow-md shadow-[#3399ff]/30'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                Documents & Uploads
              </button>
              {(isSuperAdmin || isOwnerAdmin) && (
                <button
                  onClick={() => handleTabChange('users')}
                className={`px-4 sm:px-6 py-3 rounded-lg font-semibold text-sm whitespace-nowrap transition-all duration-200 ${
                  activeTab === 'users'
                    ? 'bg-[#3399ff] text-white shadow-md shadow-[#3399ff]/30'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                  }`}
                >
                  User Management
                </button>
              )}
            </nav>
          </div>
        )}

        {/* Content Area */}
        {needsApproval ? (
          <Alert variant="warning">
            <div className="space-y-2">
              <p className="font-medium">Your account is pending approval</p>
              <p className="text-sm">
                Your account has been created but is awaiting administrative approval. 
                Once a system administrator assigns you a role and owner group, you'll be able to access all features.
              </p>
              <p className="text-sm text-gray-600">
                Please check back later or contact a system administrator if you have questions.
              </p>
            </div>
          </Alert>
        ) : !hasAdminAccess ? (
          <Alert variant="error">
            You do not have permission to access administrative features. Please contact a system administrator if you need access.
          </Alert>
        ) : activeTab === 'documents' ? (
          <div className="space-y-6">
            {/* Access Level Info */}
            <div className="bg-gradient-to-r from-blue-50 via-[#65ccff]/10 to-blue-50 border border-blue-200/60 rounded-xl p-4 sm:p-5 shadow-sm backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Your Access Level
              </h3>
              {isSuperAdmin ? (
                <p className="text-sm text-blue-800 leading-relaxed">
                  <strong className="font-semibold text-blue-900">Super Administrator</strong> - You can view and edit all documents across all owner groups, upload new documents, and manage all system users.
                </p>
              ) : (
                <p className="text-sm text-blue-800 leading-relaxed">
                  <strong className="font-semibold text-blue-900">Owner Administrator</strong> - You can view and edit documents for the following owner groups:
                  <span className="ml-2 font-semibold break-words text-blue-900">
                    {ownerGroups
                      .filter(og => og.role === 'owner_admin')
                      .map(og => og.owner_name)
                      .join(', ')}
                  </span>
                </p>
              )}
            </div>

            {/* Upload Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/80 via-white to-gray-50/80">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#3399ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload New Document
                </h2>
                <p className="text-sm text-gray-600 mt-1.5">
                  Upload PDF documents to make them available in the system
                </p>
              </div>
              <div className="p-5 sm:p-7">
                <UploadZone onUploadSuccess={() => {
                  // Immediately show the processing section (upload always creates active doc)
                  setHasActiveDocuments(true);
                  // Wait 200ms before first refresh to avoid race condition with database commit
                  // (useUpload already waits 500ms, but we add a small buffer)
                  setTimeout(() => {
                    userDocumentsTableRef.current?.refresh();
                  }, 200);
                  // Second refresh to catch any rapid Edge Function completions
                  setTimeout(() => {
                    userDocumentsTableRef.current?.refresh();
                  }, 1000);
                  // Final refresh after longer delay to catch Edge Function completion
                  setTimeout(() => {
                    userDocumentsTableRef.current?.refresh();
                  }, 3000);
                }} />
              </div>
            </div>

            {/* Processing Status - Only show when there are active documents */}
            {/* Always render the table (hidden) so ref is available for checking status */}
            <div className={hasActiveDocuments ? 'bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300' : 'hidden'}>
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/80 via-white to-gray-50/80">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Processing Status
                </h2>
                <p className="text-sm text-gray-600 mt-1.5">
                  Documents currently being processed will appear here and will move to the documents list below once complete
                </p>
              </div>
              <div className="p-5 sm:p-7">
                <UserDocumentsTable 
                  ref={userDocumentsTableRef}
                  onStatusChange={handleStatusChange}
                />
              </div>
            </div>

            {/* Documents Table */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/80 via-white to-gray-50/80">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#3399ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Manage Documents
                </h2>
                <p className="text-sm text-gray-600 mt-1.5">
                  View, edit, and manage all documents in the system
                </p>
              </div>
              <div className="p-5 sm:p-7">
                <DocumentsTable ref={documentsTableRef} isSuperAdmin={isSuperAdmin} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Access Level Info for Users Tab */}
            <div className="bg-gradient-to-r from-blue-50 via-[#65ccff]/10 to-blue-50 border border-blue-200/60 rounded-xl p-4 sm:p-5 shadow-sm backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Super Administrator Access
              </h3>
              <p className="text-sm text-blue-800 leading-relaxed">
                <strong className="font-semibold text-blue-900">Full System Control</strong> - You can view and manage all users, their roles, and permissions across all owner groups.
              </p>
            </div>

            {/* Users Table */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/80 via-white to-gray-50/80">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#3399ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  User Management
                </h2>
                <p className="text-sm text-gray-600 mt-1.5">
                  Manage user accounts, roles, and permissions
                </p>
              </div>
              <div className="p-5 sm:p-7">
                <UsersTable />
              </div>
            </div>
          </div>
        )}
      </div>
    </Dashboard>
  );
}

