import React from 'react';
import { TextInput, SelectInput, type SelectOption } from './fields';
import type { DocumentOverviewSectionProps } from './types';

export function DocumentOverviewSection({
  documentId,
  slug,
  onSlugChange,
  ownerId,
  onOwnerChange,
  owners,
  isSuperAdmin
}: DocumentOverviewSectionProps) {
  const ownerOptions: SelectOption[] = owners.map(owner => ({
    value: owner.id,
    label: owner.name
  }));

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Document Overview
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Document ID</label>
          <div className="text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded-lg break-all">{documentId}</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Slug</label>
          <TextInput
            value={slug}
            onChange={onSlugChange}
            placeholder="Enter slug..."
          />
          <p className="text-xs text-gray-500 mt-2">A URL-friendly identifier used to access this document (e.g., "kdigo-ckd-2024")</p>
        </div>
        {isSuperAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
            <SelectInput
              value={ownerId || ''}
              onChange={onOwnerChange}
              options={ownerOptions}
              placeholder="None"
            />
          </div>
        )}
      </div>
    </div>
  );
}

