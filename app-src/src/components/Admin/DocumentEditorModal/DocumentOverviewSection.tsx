import React from 'react';
import { Toggle } from '@/components/UI/Toggle';
import { TextInput, SearchSelect, type SelectOption } from './fields';
import type { DocumentOverviewSectionProps } from './types';

export function DocumentOverviewSection({
  documentId,
  slug,
  onSlugChange,
  ownerId,
  onOwnerChange,
  owners,
  isSuperAdmin,
  active,
  onFieldChange,
  savingField = null,
  savedField = null
}: DocumentOverviewSectionProps) {
  const ownerOptions: SelectOption[] = owners.map(owner => ({
    value: owner.id,
    label: owner.name
  }));

  const FieldIndicator = ({ fieldName }: { fieldName: string }) => {
    if (savingField === fieldName) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 ml-2">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Saving...</span>
        </span>
      );
    }
    if (savedField === fieldName) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 ml-2">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Saved!</span>
        </span>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Document Overview
      </h4>
      <div className="space-y-4">
        {/* Enabled/Disabled Toggle */}
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <Toggle
            checked={active || false}
            onChange={(checked) => onFieldChange('active', checked)}
            label={
              <span className="inline-flex items-center">
                Document Status
                <FieldIndicator fieldName="active" />
              </span>
            }
            description="When enabled, this document is available for users to access"
            size="md"
          />
        </div>

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
              <SearchSelect
                value={ownerId || ''}
                onChange={onOwnerChange}
                options={ownerOptions}
                placeholder="None"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

