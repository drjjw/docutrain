import React from 'react';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { UsersTable } from '@/components/Admin/UsersTable';
import { PermissionsBadge } from '@/components/Dashboard/PermissionsBadge';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert } from '@/components/UI/Alert';
import { Spinner } from '@/components/UI/Spinner';
import { useNavigate } from 'react-router-dom';

export function UsersAdminPage() {
  const { permissions, loading, isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  const handleTabChange = (tab: 'documents' | 'users') => {
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

  if (!isSuperAdmin) {
    return (
      <Dashboard>
        <Alert variant="error">
          You do not have permission to access this page. Only super administrators can manage users.
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
            <PermissionsBadge role="super_admin" />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => handleTabChange('documents')}
              className="py-2 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Documents
            </button>
            <button
              onClick={() => handleTabChange('users')}
              className="py-2 px-1 border-b-2 font-medium text-sm border-blue-500 text-blue-600"
            >
              Users
            </button>
          </nav>
        </div>

        {/* Access Level Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-1">Super Administrator Access</h3>
          <p className="text-sm text-blue-700">
            <strong>Full System Control</strong> - You can view and manage all users, their roles, and permissions across all owner groups.
          </p>
        </div>

        {/* Users Table */}
        <UsersTable />
      </div>
    </Dashboard>
  );
}
