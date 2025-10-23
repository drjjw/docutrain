import React, { useState } from 'react';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { DocumentsTable } from '@/components/Admin/DocumentsTable';
import { PermissionsBadge } from '@/components/Dashboard/PermissionsBadge';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert } from '@/components/UI/Alert';
import { Spinner } from '@/components/UI/Spinner';
import { useNavigate, useLocation } from 'react-router-dom';

export function AdminPage() {
  const { permissions, loading, isSuperAdmin, ownerGroups } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'documents' | 'users'>('documents');

  const hasAdminAccess = isSuperAdmin || (ownerGroups && ownerGroups.some(
    og => og.role === 'owner_admin'
  ));

  // Set active tab based on current route
  React.useEffect(() => {
    if (location.pathname.includes('/admin/users')) {
      setActiveTab('users');
    } else {
      setActiveTab('documents');
    }
  }, [location.pathname]);

  const handleTabChange = (tab: 'documents' | 'users') => {
    setActiveTab(tab);
    if (tab === 'users') {
      navigate('/admin/users');
    } else {
      navigate('/admin/documents');
    }
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

  if (!hasAdminAccess) {
    return (
      <Dashboard>
        <Alert variant="error">
          You do not have permission to access this page. Only super administrators and owner administrators can manage documents.
        </Alert>
      </Dashboard>
    );
  }

  return (
    <Dashboard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage documents and users in the system
            </p>
          </div>
          <div className="flex gap-2">
            {isSuperAdmin ? (
              <PermissionsBadge role="super_admin" />
            ) : (
              ownerGroups.map((og) => (
                <PermissionsBadge
                  key={og.owner_id}
                  role={og.role}
                  ownerName={og.owner_name}
                />
              ))
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => handleTabChange('documents')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'documents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Documents
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => handleTabChange('users')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Users
              </button>
            )}
          </nav>
        </div>

        {/* Access Level Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-1">Your Access Level</h3>
          {activeTab === 'users' ? (
            <p className="text-sm text-blue-700">
              <strong>Super Administrator</strong> - You can view and manage all users and their permissions across the system.
            </p>
          ) : isSuperAdmin ? (
            <p className="text-sm text-blue-700">
              <strong>Super Administrator</strong> - You can view and edit all documents across all owner groups.
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

        {/* Documents Table */}
        <DocumentsTable isSuperAdmin={isSuperAdmin} />
      </div>
    </Dashboard>
  );
}

