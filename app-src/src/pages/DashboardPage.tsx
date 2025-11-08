import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { CombinedUploadZone, CombinedUploadZoneRef } from '@/components/Upload/CombinedUploadZone';
import { DocumentsTable, DocumentsTableRef } from '@/components/Admin/DocumentsTable';
import { UserDocumentsTable, UserDocumentsTableRef } from '@/components/Admin/UserDocumentsTable';
import { UsersTable } from '@/components/Admin/UsersTable';
import { OwnersTable } from '@/components/Admin/OwnersTable';
import { OwnerSettings } from '@/components/Admin/OwnerSettings';
import { PermissionsBadge } from '@/components/Dashboard/PermissionsBadge';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert } from '@/components/UI/Alert';
import { Spinner } from '@/components/UI/Spinner';
import { getUserProfile } from '@/lib/supabase/database';
import { getDocuments } from '@/lib/supabase/admin';
import { docutrainIconUrl } from '@/assets';
import type { UserRole } from '@/types/permissions';

export function DashboardPage() {
  const { user } = useAuth();
  const { loading, isSuperAdmin, isOwnerAdmin, ownerGroups, needsApproval } = usePermissions();
  const [userProfile, setUserProfile] = useState<{ first_name?: string; last_name?: string } | null>(null);
  
  // Debug logging
  console.log('DashboardPage - ownerGroups:', ownerGroups);
  
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'documents' | 'users' | 'owners' | 'owner-settings'>('documents');
  const userDocumentsTableRef = useRef<UserDocumentsTableRef>(null);
  const documentsTableRef = useRef<DocumentsTableRef>(null);
  const uploadZoneRef = useRef<CombinedUploadZoneRef>(null);
  const [hasActiveDocuments, setHasActiveDocuments] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevHasActiveRef = useRef<boolean>(false);

  const hasAdminAccess = isSuperAdmin || (ownerGroups && ownerGroups.some(
    og => og.role === 'owner_admin'
  ));

  // Note: Regular users are now redirected at the route level (AdminRoute)
  // This prevents the flash of restricted content before redirect

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
  const handleStatusChange = React.useCallback(async (completedDocumentId?: string) => {
    if (userDocumentsTableRef.current && documentsTableRef.current) {
      const hasActive = userDocumentsTableRef.current.hasActiveDocuments();
      const prevHasActive = prevHasActiveRef.current;
      prevHasActiveRef.current = hasActive;
      setHasActiveDocuments(hasActive);
      
      // Refresh DocumentsTable on any status change
      // This ensures the main documents table updates when processing completes
      console.log('📊 Status change detected:', { hasActive, prevHasActive, completedDocumentId });
      
      // If a document completed processing, find it in the documents table and open modal
      if (completedDocumentId && user?.id) {
        try {
          // Reduced delay for faster modal appearance - document should be ready quickly after status change
          setTimeout(async () => {
            const allDocuments = await getDocuments(user.id);
            // Find document by matching metadata.user_document_id
            const completedDoc = allDocuments.find(doc => {
              const metadata = doc.metadata as Record<string, any> | null;
              return metadata?.user_document_id === completedDocumentId;
            });
            
            if (completedDoc) {
              console.log('✅ Found completed document:', completedDoc.id, completedDoc.title);
              // Close upload success modal if it's still open
              uploadZoneRef.current?.closeModal();
              // Check if document already has category configured
              const needsConfig = !completedDoc.category;
              // Open modal with config prompt if category is missing
              await documentsTableRef.current?.openEditorModal(completedDoc.id, needsConfig);
            } else {
              console.warn('⚠️ Completed document not found in documents table yet, retrying...');
              // Retry after shorter delay
              setTimeout(async () => {
                const retryDocuments = await getDocuments(user.id);
                const retryDoc = retryDocuments.find(doc => {
                  const metadata = doc.metadata as Record<string, any> | null;
                  return metadata?.user_document_id === completedDocumentId;
                });
                if (retryDoc) {
                  // Close upload success modal if it's still open
                  uploadZoneRef.current?.closeModal();
                  const needsConfig = !retryDoc.category;
                  await documentsTableRef.current?.openEditorModal(retryDoc.id, needsConfig);
                }
              }, 1000);
            }
          }, 300);
        } catch (error) {
          console.error('Error finding completed document:', error);
        }
      }
      
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
  }, [user?.id]);

  // Set active tab based on current route
  React.useEffect(() => {
    if (location.pathname.includes('/users')) {
      setActiveTab('users');
    } else if (location.pathname.includes('/owners')) {
      setActiveTab('owners');
    } else if (location.pathname.includes('/owner-settings')) {
      setActiveTab('owner-settings');
    } else {
      setActiveTab('documents');
    }
  }, [location.pathname]);

  const handleTabChange = (tab: 'documents' | 'users' | 'owners' | 'owner-settings') => {
    setActiveTab(tab);
    if (tab === 'users') {
      navigate('/users');
    } else if (tab === 'owners') {
      navigate('/owners');
    } else if (tab === 'owner-settings') {
      navigate('/owner-settings');
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
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* User Avatar or Owner Logo */}
            {isSuperAdmin ? (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white border-2 border-gray-200/60 shadow-sm flex items-center justify-center flex-shrink-0 p-2 transition-transform duration-300 hover:scale-105">
                <img 
                  src={docutrainIconUrl} 
                  alt="DocuTrain" 
                  className="w-full h-full object-contain"
                  title="Super Administrator"
                />
              </div>
            ) : hasAdminAccess && ownerGroups.length > 0 && ownerGroups[0].owner_logo_url ? (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white border-2 border-gray-200/60 shadow-sm flex items-center justify-center flex-shrink-0 p-2 transition-transform duration-300 hover:scale-105">
                <img 
                  src={ownerGroups[0].owner_logo_url} 
                  alt={ownerGroups[0].owner_name} 
                  className="w-full h-full object-contain"
                  title={ownerGroups[0].owner_name}
                />
              </div>
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-docutrain-light flex items-center justify-center text-xl sm:text-2xl font-bold text-white flex-shrink-0 shadow-lg shadow-docutrain-light/30 transition-transform duration-300 hover:scale-105">
                {getUserInitials()}
              </div>
            )}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-500 mb-2">
                Welcome back
              </h1>
              <p className="text-2xl sm:text-3xl text-gray-900 break-words font-bold mb-4">
                {getUserDisplayName()}
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                {isSuperAdmin ? (
                  <PermissionsBadge role="super_admin" />
                ) : hasAdminAccess ? (
                  <>
                    {ownerGroups.map((og) => (
                      <div key={og.owner_id} className="flex items-center gap-2.5">
                        <PermissionsBadge role={og.role as UserRole} />
                        {og.owner_name && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span className="text-sm text-gray-700 font-medium">
                              {og.owner_name}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Only show if user has admin access */}
        {hasAdminAccess && (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
            <nav className="flex flex-col sm:flex-row">
              <button
                onClick={() => handleTabChange('documents')}
                className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm text-center sm:text-left whitespace-nowrap transition-all duration-200 relative ${
                  activeTab === 'documents'
                    ? 'text-docutrain-light border border-blue-100 border-b-2 border-b-docutrain-light bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
              >
                Documents & Uploads
              </button>
              {(isSuperAdmin || isOwnerAdmin) && (
                <button
                  onClick={() => handleTabChange('users')}
                className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm text-center sm:text-left whitespace-nowrap transition-all duration-200 relative ${
                  activeTab === 'users'
                    ? 'text-docutrain-light border border-blue-100 border-b-2 border-b-docutrain-light bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 sm:ml-1'
                  }`}
                >
                  User Management
                </button>
              )}
              {isOwnerAdmin && !isSuperAdmin && (
                <button
                  onClick={() => handleTabChange('owner-settings')}
                className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm text-center sm:text-left whitespace-nowrap transition-all duration-200 relative ${
                  activeTab === 'owner-settings'
                    ? 'text-docutrain-light border border-blue-100 border-b-2 border-b-docutrain-light bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 sm:ml-1'
                  }`}
                >
                  Owner Settings
                </button>
              )}
              {isSuperAdmin && (
                <button
                  onClick={() => handleTabChange('owners')}
                className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm text-center sm:text-left whitespace-nowrap transition-all duration-200 relative ${
                  activeTab === 'owners'
                    ? 'text-docutrain-light border border-blue-100 border-b-2 border-b-docutrain-light bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 sm:ml-1'
                  }`}
                >
                  Owner Management
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
                Please check back later or{' '}
                <Link to="/contact" className="text-blue-600 hover:text-blue-700 font-medium underline">
                  contact us
                </Link>
                {' '}if you have questions.
              </p>
            </div>
          </Alert>
        ) : !hasAdminAccess ? (
          <Alert variant="error">
            You do not have permission to access administrative features. Please contact a system administrator if you need access.
          </Alert>
        ) : activeTab === 'documents' ? (
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gray-50">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload New Document
                </h2>
                <p className="text-sm text-gray-600 mt-1.5">
                  Upload PDF documents or paste text content to make them available in the system
                </p>
              </div>
              <div className="p-5 sm:p-7">
                <CombinedUploadZone 
                  ref={uploadZoneRef}
                  onUploadSuccess={() => {
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
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gray-50">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gray-50">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Manage Documents
                </h2>
                <p className="text-sm text-gray-600 mt-1.5">
                  View, edit, and manage all documents in the system
                </p>
              </div>
              <div className="p-5 sm:p-7">
                <DocumentsTable 
                  ref={documentsTableRef} 
                  isSuperAdmin={isSuperAdmin}
                  onRetrainingStart={(userDocumentId) => {
                    // When retraining starts, refresh the processing area to show the retraining document
                    console.log('🔄 Retraining started, refreshing processing area:', userDocumentId);
                    setHasActiveDocuments(true);
                    // Refresh after a short delay to allow database to update
                    setTimeout(() => {
                      userDocumentsTableRef.current?.refresh();
                    }, 500);
                    // Also refresh again after a longer delay to catch any async updates
                    setTimeout(() => {
                      userDocumentsTableRef.current?.refresh();
                    }, 2000);
                  }}
                  onRetrainSuccess={(userDocumentId) => {
                    // Immediately trigger status change handler to open modal - bypasses polling delay
                    console.log('✅ Retraining completed, immediately triggering modal:', userDocumentId);
                    handleStatusChange(userDocumentId);
                  }}
                />
              </div>
            </div>
          </div>
        ) : activeTab === 'users' ? (
          <div className="space-y-6">
            {/* Users Table */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gray-50">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        ) : activeTab === 'owner-settings' ? (
          <div className="space-y-6">
            {/* Access Level Info for Owner Settings Tab */}
            <div className="bg-docutrain-light/10 border border-docutrain-light/30 rounded-xl p-4 sm:p-5 shadow-sm backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-docutrain-dark mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Owner Admin Access
              </h3>
              <p className="text-sm text-docutrain-dark leading-relaxed">
                <strong className="font-semibold text-docutrain-dark">Owner Settings</strong> - You can manage your owner group's branding and configuration settings, including logo, intro message, default cover image, and accent color.
              </p>
            </div>

            {/* Owner Settings Component */}
            {ownerGroups.length > 0 && ownerGroups[0].owner_id && (
              <OwnerSettings ownerId={ownerGroups[0].owner_id} />
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Owners Table */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gray-50">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Owner Management
                </h2>
                <p className="text-sm text-gray-600 mt-1.5">
                  Manage document owners and their configurations
                </p>
              </div>
              <div className="p-5 sm:p-7">
                <OwnersTable />
              </div>
            </div>
          </div>
        )}
      </div>
    </Dashboard>
  );
}
