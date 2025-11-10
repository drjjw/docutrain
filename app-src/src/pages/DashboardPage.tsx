import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { CombinedUploadZone, CombinedUploadZoneRef } from '@/components/Upload/CombinedUploadZone';
import { DocumentsTable, DocumentsTableRef } from '@/components/Admin/DocumentsTable';
import { UserDocumentsTable, UserDocumentsTableRef } from '@/components/Admin/UserDocumentsTable';
import { UsersTable } from '@/components/Admin/UsersTable';
import { OwnersTable } from '@/components/Admin/OwnersTable';
import { OwnerSettings } from '@/components/Admin/OwnerSettings';
import { MissionControl } from '@/components/Admin/MissionControl';
import { CategoryManagement } from '@/components/Admin/CategoryManagement';
import { getAllOwners } from '@/lib/supabase/admin';
import type { Owner } from '@/types/admin';
import { PermissionsBadge } from '@/components/Dashboard/PermissionsBadge';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert } from '@/components/UI/Alert';
import { Spinner } from '@/components/UI/Spinner';
import { getUserProfile } from '@/lib/supabase/database';
import { getDocuments } from '@/lib/supabase/admin';
import { docutrainIconUrl } from '@/assets';
import type { UserRole } from '@/types/permissions';
import { debugLog } from '@/utils/debug';

export function DashboardPage() {
  const { user } = useAuth();
  const { loading, isSuperAdmin, isOwnerAdmin, ownerGroups, needsApproval } = usePermissions();
  const [userProfile, setUserProfile] = useState<{ first_name?: string; last_name?: string } | null>(null);
  const [allOwners, setAllOwners] = useState<Owner[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  
  // Debug logging
  debugLog('DashboardPage - ownerGroups:', ownerGroups);
  
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'documents' | 'users' | 'owners' | 'owner-settings' | 'mission-control' | 'category-management'>('documents');
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

  // Fetch all owners for super admin owner settings
  React.useEffect(() => {
    const fetchOwners = async () => {
      if (isSuperAdmin && activeTab === 'owner-settings') {
        try {
          const owners = await getAllOwners();
          setAllOwners(owners);
          // Auto-select first owner if none selected
          if (!selectedOwnerId && owners.length > 0) {
            setSelectedOwnerId(owners[0].id);
          }
        } catch (err) {
          console.error('Failed to fetch owners:', err);
        }
      }
    };
    fetchOwners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, activeTab]);

  // Set selected owner when ownerGroups change (for owner admins)
  React.useEffect(() => {
    if (!isSuperAdmin && ownerGroups.length > 0 && ownerGroups[0].owner_id) {
      setSelectedOwnerId(ownerGroups[0].owner_id);
    }
  }, [isSuperAdmin, ownerGroups]);

  // Handler for status changes from UserDocumentsTable
  const handleStatusChange = React.useCallback(async (completedDocumentId?: string) => {
    if (userDocumentsTableRef.current && documentsTableRef.current) {
      const hasActive = userDocumentsTableRef.current.hasActiveDocuments();
      const prevHasActive = prevHasActiveRef.current;
      prevHasActiveRef.current = hasActive;
      setHasActiveDocuments(hasActive);
      
      // Refresh DocumentsTable on any status change
      // This ensures the main documents table updates when processing completes
      debugLog('📊 Status change detected:', { hasActive, prevHasActive, completedDocumentId });
      
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
              debugLog('✅ Found completed document:', completedDoc.id, completedDoc.title);
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
        debugLog('🔄 Refreshing DocumentsTable after status change');
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
    } else if (location.pathname.includes('/mission-control')) {
      setActiveTab('mission-control');
    } else if (location.pathname.includes('/category-management')) {
      setActiveTab('category-management');
    } else {
      setActiveTab('documents');
    }
  }, [location.pathname]);

  const handleTabChange = (tab: 'documents' | 'users' | 'owners' | 'owner-settings' | 'mission-control' | 'category-management') => {
    setActiveTab(tab);
    if (tab === 'users') {
      navigate('/users');
    } else if (tab === 'owners') {
      navigate('/owners');
    } else if (tab === 'owner-settings') {
      navigate('/owner-settings');
    } else if (tab === 'mission-control') {
      navigate('/mission-control');
    } else if (tab === 'category-management') {
      navigate('/category-management');
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
                    {ownerGroups
                      .filter((og) => og.role !== 'registered') // Filter out registered role - only show admin roles
                      .map((og) => (
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
                    ? 'border border-blue-100'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                }`}
                style={activeTab === 'documents' ? { backgroundColor: 'rgb(219 234 254 / var(--tw-border-opacity))', color: 'rgb(18 136 254)', '--tw-text-opacity': '1' } as React.CSSProperties : undefined}
              >
                Documents & Uploads
              </button>
              {(isSuperAdmin || isOwnerAdmin) && (
                <button
                  onClick={() => handleTabChange('users')}
                className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm text-center sm:text-left whitespace-nowrap transition-all duration-200 relative ${
                  activeTab === 'users'
                    ? 'border border-blue-100'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 sm:ml-1'
                  }`}
                  style={activeTab === 'users' ? { backgroundColor: 'rgb(219 234 254 / var(--tw-border-opacity))', color: 'rgb(18 136 254)', '--tw-text-opacity': '1' } as React.CSSProperties : undefined}
                >
                  User Management
                </button>
              )}
              {isOwnerAdmin && !isSuperAdmin && (
                <button
                  onClick={() => handleTabChange('owner-settings')}
                className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm text-center sm:text-left whitespace-nowrap transition-all duration-200 relative ${
                  activeTab === 'owner-settings'
                    ? 'border border-blue-100'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 sm:ml-1'
                  }`}
                  style={activeTab === 'owner-settings' ? { backgroundColor: 'rgb(219 234 254 / var(--tw-border-opacity))', color: 'rgb(18 136 254)', '--tw-text-opacity': '1' } as React.CSSProperties : undefined}
                >
                  Owner Settings
                </button>
              )}
              {isSuperAdmin && (
                <>
                  <button
                    onClick={() => handleTabChange('owners')}
                    className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm text-center sm:text-left whitespace-nowrap transition-all duration-200 relative ${
                      activeTab === 'owners'
                        ? 'border border-blue-100'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 sm:ml-1'
                    }`}
                    style={activeTab === 'owners' ? { backgroundColor: 'rgb(219 234 254 / var(--tw-border-opacity))', color: 'rgb(18 136 254)', '--tw-text-opacity': '1' } as React.CSSProperties : undefined}
                  >
                    Owner Management
                  </button>
                  <button
                    onClick={() => handleTabChange('category-management')}
                    className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm text-center sm:text-left whitespace-nowrap transition-all duration-200 relative ${
                      activeTab === 'category-management'
                        ? 'border border-blue-100'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 sm:ml-1'
                    }`}
                    style={activeTab === 'category-management' ? { backgroundColor: 'rgb(219 234 254 / var(--tw-border-opacity))', color: 'rgb(18 136 254)', '--tw-text-opacity': '1' } as React.CSSProperties : undefined}
                  >
                    Category Management
                  </button>
                  <button
                    onClick={() => handleTabChange('mission-control')}
                    className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm text-center sm:text-left whitespace-nowrap transition-all duration-200 relative ${
                      activeTab === 'mission-control'
                        ? 'border border-blue-100'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 sm:ml-1'
                    }`}
                    style={activeTab === 'mission-control' ? { backgroundColor: 'rgb(219 234 254 / var(--tw-border-opacity))', color: 'rgb(18 136 254)', '--tw-text-opacity': '1' } as React.CSSProperties : undefined}
                  >
                    🚀 Mission Control
                  </button>
                </>
              )}
              {/* Category Management tab for owner-admins (when not super admin) */}
              {isOwnerAdmin && !isSuperAdmin && (
                <button
                  onClick={() => handleTabChange('category-management')}
                  className={`px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm text-center sm:text-left whitespace-nowrap transition-all duration-200 relative ${
                    activeTab === 'category-management'
                      ? 'border border-blue-100'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50 sm:ml-1'
                  }`}
                  style={activeTab === 'category-management' ? { backgroundColor: 'rgb(219 234 254 / var(--tw-border-opacity))', color: 'rgb(18 136 254)', '--tw-text-opacity': '1' } as React.CSSProperties : undefined}
                >
                  Categories
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
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload New Document
                </h2>
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
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Processing Status
                </h2>
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
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Manage Documents
                </h2>
              </div>
              <div className="p-5 sm:p-7">
                <DocumentsTable 
                  ref={documentsTableRef} 
                  isSuperAdmin={isSuperAdmin}
                  onRetrainingStart={(userDocumentId) => {
                    // When retraining starts, refresh the processing area to show the retraining document
                    debugLog('🔄 Retraining started, refreshing processing area:', userDocumentId);
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
                    debugLog('✅ Retraining completed, immediately triggering modal:', userDocumentId);
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
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  User Management
                </h2>
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
                {isSuperAdmin ? 'Super Admin Access' : 'Owner Admin Access'}
              </h3>
              <p className="text-sm text-docutrain-dark leading-relaxed">
                {isSuperAdmin 
                  ? "Manage any owner group's branding and configuration settings, including logo, intro message, default cover image, accent color, and document categories."
                  : "You can manage your owner group's branding and configuration settings, including logo, intro message, default cover image, and accent color."}
              </p>
            </div>

            {/* Owner Selector for Super Admins */}
            {isSuperAdmin && allOwners.length > 0 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-600">
                    Choose which owner group's settings you want to manage
                  </p>
                </div>
                <div className="p-6">
                  <select
                    value={selectedOwnerId || ''}
                    onChange={(e) => setSelectedOwnerId(e.target.value || null)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm font-medium text-gray-700 bg-white"
                  >
                    <option value="">Select an owner group...</option>
                    {allOwners.map(owner => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Owner Settings Component */}
            {selectedOwnerId && (
              <OwnerSettings ownerId={selectedOwnerId} />
            )}
            {!selectedOwnerId && !isSuperAdmin && ownerGroups.length === 0 && (
              <Alert variant="error">
                You don't have access to any owner groups. Please contact an administrator.
              </Alert>
            )}
          </div>
        ) : activeTab === 'mission-control' ? (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gray-50">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Mission Control
                </h2>
              </div>
              <div className="p-5 sm:p-7">
                <MissionControl />
              </div>
            </div>
          </div>
        ) : activeTab === 'category-management' ? (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gray-50">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  {isSuperAdmin ? 'Category Management' : 'Categories'}
                </h2>
              </div>
              <div className="p-5 sm:p-7">
                <CategoryManagement ownerId={isSuperAdmin ? null : (selectedOwnerId || ownerGroups[0]?.owner_id || null)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Owners Table */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gray-50">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Owner Management
                </h2>
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
