import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { UploadZone } from '@/components/Upload/UploadZone';
import { DocumentsTable } from '@/components/Admin/DocumentsTable';
import { UsersTable } from '@/components/Admin/UsersTable';
import { PermissionsBadge } from '@/components/Dashboard/PermissionsBadge';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert } from '@/components/UI/Alert';
import { Spinner } from '@/components/UI/Spinner';

export function DashboardPage() {
  const { user } = useAuth();
  const { permissions, loading, isSuperAdmin, ownerGroups } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'documents' | 'users'>('documents');

  const hasAdminAccess = isSuperAdmin || (ownerGroups && ownerGroups.some(
    og => og.role === 'owner_admin'
  ));

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

  // Get user initials for avatar
  const getUserInitials = () => {
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
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white">
              {getUserInitials()}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Welcome back!
              </h1>
              <p className="text-gray-600">
                {user?.email}
              </p>
            </div>
            <div className="flex gap-2">
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

        {/* Navigation Tabs - Only show if user has admin access */}
        {hasAdminAccess && (
          <div className="border-b border-gray-200 bg-white rounded-t-lg shadow-sm">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => handleTabChange('documents')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'documents'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Documents & Uploads
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => handleTabChange('users')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'users'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  User Management
                </button>
              )}
            </nav>
          </div>
        )}

        {/* Content Area */}
        {!hasAdminAccess ? (
          <Alert variant="error">
            You do not have permission to access administrative features. Please contact a system administrator if you need access.
          </Alert>
        ) : activeTab === 'documents' ? (
          <div className="space-y-6">
            {/* Access Level Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-medium text-blue-900 mb-1">Your Access Level</h3>
              {isSuperAdmin ? (
                <p className="text-sm text-blue-700">
                  <strong>Super Administrator</strong> - You can view and edit all documents across all owner groups, upload new documents, and manage all system users.
                </p>
              ) : (
                <p className="text-sm text-blue-700">
                  <strong>Owner Administrator</strong> - You can view and edit documents for the following owner groups:
                  <span className="ml-2 font-medium">
                    {ownerGroups
                      .filter(og => og.role === 'owner_admin')
                      .map(og => og.owner_name)
                      .join(', ')}
                  </span>
                </p>
              )}
            </div>

            {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="text-lg font-semibold text-gray-900">Upload New Document</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Upload PDF documents to make them available in the system
                </p>
              </div>
              <div className="p-6">
                <UploadZone />
              </div>
            </div>

            {/* Documents Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="text-lg font-semibold text-gray-900">Manage Documents</h2>
                <p className="text-sm text-gray-600 mt-1">
                  View, edit, and manage all documents in the system
                </p>
              </div>
              <div className="p-6">
                <DocumentsTable isSuperAdmin={isSuperAdmin} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Access Level Info for Users Tab */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-medium text-blue-900 mb-1">Super Administrator Access</h3>
              <p className="text-sm text-blue-700">
                <strong>Full System Control</strong> - You can view and manage all users, their roles, and permissions across all owner groups.
              </p>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Manage user accounts, roles, and permissions
                </p>
              </div>
              <div className="p-6">
                <UsersTable />
              </div>
            </div>
          </div>
        )}
      </div>
    </Dashboard>
  );
}

