import React from 'react';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { UploadZone } from '@/components/Upload/UploadZone';
import { DocumentList } from '@/components/Documents/DocumentList';
import { OwnerGroups } from '@/components/Dashboard/OwnerGroups';

export function DashboardPage() {
  return (
    <Dashboard>
      <div className="space-y-8">
        {/* Permissions & Owner Groups Section */}
        <OwnerGroups />

        {/* Upload Section */}
        <UploadZone />

        {/* Documents Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Uploaded Documents</h2>
          <DocumentList />
        </div>
      </div>
    </Dashboard>
  );
}

