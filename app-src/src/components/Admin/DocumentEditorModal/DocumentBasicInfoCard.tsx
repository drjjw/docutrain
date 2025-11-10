import React, { useState, useEffect } from 'react';
import { TextInput, SelectInput, NumberInput, type SelectOption } from './fields';
import type { DocumentBasicInfoCardProps } from './types';
import { getCategoryOptions } from '@/utils/categories';
import { DEFAULT_CATEGORY_OPTIONS } from '@/constants/categories';

export function DocumentBasicInfoCard({
  title,
  subtitle,
  categoryObj,
  year,
  backLink,
  onFieldChange,
  isSuperAdmin,
  yearError,
  owner,
}: DocumentBasicInfoCardProps) {
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>(
    DEFAULT_CATEGORY_OPTIONS.map(cat => ({ value: cat, label: cat }))
  );
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Fetch category options on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const options = await getCategoryOptions(owner);
        setCategoryOptions(options.map(cat => ({ value: cat, label: cat })));
      } catch (error) {
        console.error('Failed to load category options:', error);
        // Fallback to constants already set
      } finally {
        setLoadingCategories(false);
      }
    };
    
    fetchCategories();
  }, [owner]);

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
              value={categoryObj?.name || ''}
              onChange={(value) => onFieldChange('category', value === '' ? null : value)}
              options={categoryOptions}
              placeholder={loadingCategories ? "Loading..." : "None"}
              disabled={loadingCategories}
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

