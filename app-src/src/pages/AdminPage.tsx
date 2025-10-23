import React from 'react';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { DocumentsTable } from '@/components/Admin/DocumentsTable';
import { PermissionsBadge } from '@/components/Dashboard/PermissionsBadge';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert } from '@/components/UI/Alert';
import { Spinner } from '@/components/UI/Spinner';

export function AdminPage() {
  const { permissions, loading, isSuperAdmin, ownerGroups } = usePermissions();

  const hasAdminAccess = isSuperAdmin || (ownerGroups && ownerGroups.some(
    og => og.role === 'owner_admin'
  ));

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
            <h1 className="text-2xl font-bold text-gray-900">Document Administration</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage all documents in the system
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

        {/* Access Level Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-1">Your Access Level</h3>
          {isSuperAdmin ? (
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
        <DocumentsTable />
      </div>
    </Dashboard>
  );
}

