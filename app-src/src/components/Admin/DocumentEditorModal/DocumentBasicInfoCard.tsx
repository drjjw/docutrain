import React from 'react';
import { TextInput, SelectInput, NumberInput, type SelectOption } from './fields';
import type { DocumentBasicInfoCardProps } from './types';

export function DocumentBasicInfoCard({
  title,
  subtitle,
  category,
  year,
  backLink,
  onFieldChange,
  isSuperAdmin,
  yearError
}: DocumentBasicInfoCardProps) {
  const categoryOptions: SelectOption[] = [
    { value: 'Guidelines', label: 'Guidelines' },
    { value: 'Maker', label: 'Maker' },
    { value: 'Manuals', label: 'Manuals' },
    { value: 'Presentation', label: 'Presentation' },
    { value: 'Recipes', label: 'Recipes' },
    { value: 'Reviews', label: 'Reviews' },
    { value: 'Slides', label: 'Slides' },
    { value: 'Training', label: 'Training' }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h4 className="text-lg font-semibold text-gray-900">Basic Information</h4>
        </div>
      </div>
      <div className="px-6 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
          <TextInput
            value={title}
            onChange={(value) => onFieldChange('title', value)}
            placeholder="Enter title..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
          <TextInput
            value={subtitle}
            onChange={(value) => onFieldChange('subtitle', value)}
            placeholder="Enter subtitle..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <SelectInput
              value={category || ''}
              onChange={(value) => onFieldChange('category', value === '' ? null : value)}
              options={categoryOptions}
              placeholder="None"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
            <NumberInput
              value={year}
              onChange={(value) => onFieldChange('year', value)}
              min={1900}
              max={2100}
              error={!!yearError}
              errorMessage={yearError || undefined}
            />
          </div>
        </div>
        {isSuperAdmin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Back Link</label>
            <TextInput
              value={backLink}
              onChange={(value) => onFieldChange('back_link', value)}
              placeholder="Enter back link..."
            />
          </div>
        )}
      </div>
    </div>
  );
}

