import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Card } from '@/components/UI/Card';
import { Spinner } from '@/components/UI/Spinner';
import { PermissionsBadge } from './PermissionsBadge';

export function OwnerGroups() {
  const { permissions, loading, ownerGroups, isSuperAdmin } = usePermissions();

  if (loading) {
    return (
      <Card>
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      </Card>
    );
  }

  if (ownerGroups.length === 0) {
    return (
      <Card>
        <div className="text-center py-4">
          <p className="text-sm text-gray-600">
            No owner group access yet. Contact an administrator to request access.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Access</h3>
      
      {isSuperAdmin && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <PermissionsBadge role="super_admin" />
          <p className="text-sm text-gray-700 mt-2">
            You have full system access to all owner groups and documents.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {ownerGroups
          .filter((group) => group.role !== 'registered') // Filter out registered role - only show admin roles
          .map((group) => (
            <div
              key={`${group.owner_id}-${group.role}`}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-gray-900">{group.owner_name}</p>
                <p className="text-sm text-gray-500">{group.owner_slug}</p>
              </div>
              <PermissionsBadge role={group.role} ownerName={group.owner_name} />
            </div>
          ))}
      </div>
    </Card>
  );
}

