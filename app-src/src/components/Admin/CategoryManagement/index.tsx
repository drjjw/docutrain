import React, { useState, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { Spinner } from '@/components/UI/Spinner';
import { getCategoriesForOwner, createCategory, deleteCategory } from '@/lib/supabase/admin';
import { DEFAULT_CATEGORY_OPTIONS } from '@/constants/categories';
import { invalidateCategoryCache } from '@/utils/categories';
import type { Category } from '@/types/admin';

interface CategoryManagementProps {
  ownerId?: string | null; // If provided, manages owner-specific categories. If null, manages system defaults.
}

export function CategoryManagement({ ownerId = null }: CategoryManagementProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const isOwnerSpecific = ownerId !== null;

  // Load categories based on mode
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoading(true);
        setError(null);
        const allCategories = await getCategoriesForOwner(ownerId);
        
        // Filter based on mode
        const filteredCategories = isOwnerSpecific
          ? allCategories.filter(cat => cat.owner_id === ownerId) // Owner-specific only
          : allCategories.filter(cat => cat.owner_id === null); // System defaults only
        
        setCategories(filteredCategories);
        
        // Get most recent updated_at
        if (filteredCategories.length > 0) {
          const mostRecent = filteredCategories.reduce((latest, cat) => {
            const catDate = new Date(cat.updated_at).getTime();
            const latestDate = new Date(latest.updated_at).getTime();
            return catDate > latestDate ? cat : latest;
          });
          setLastUpdated(new Date(mostRecent.updated_at).toLocaleString());
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
        setError(isOwnerSpecific 
          ? 'Failed to load owner categories. Using fallback values.'
          : 'Failed to load default categories. Using fallback values.');
        // Fallback: create categories from constants (only for system defaults)
        if (!isOwnerSpecific) {
          const fallbackCategories: Category[] = DEFAULT_CATEGORY_OPTIONS.map((name, idx) => ({
            id: idx,
            name,
            is_custom: false,
            owner_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));
          setCategories(fallbackCategories);
        } else {
          setCategories([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [ownerId, isOwnerSpecific]);

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) {
      setError('Category name cannot be empty');
      return;
    }
    if (categories.some(cat => cat.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('This category already exists');
      return;
    }

    // If owner-specific mode, check if it conflicts with system defaults
    if (isOwnerSpecific) {
      try {
        const systemDefaults = await getCategoriesForOwner(null);
        const systemDefaultNames = systemDefaults
          .filter(cat => cat.owner_id === null)
          .map(cat => cat.name.toLowerCase());
        
        if (systemDefaultNames.includes(trimmed.toLowerCase())) {
          setError('This category already exists as a system default. Please use the existing category instead.');
          return;
        }
      } catch (err) {
        console.warn('Failed to check system defaults:', err);
        // Continue anyway - better to allow than block
      }
    }

    try {
      setSaving(true);
      setError(null);
      
      // Create category in database
      const newCat = await createCategory({
        name: trimmed,
        is_custom: isOwnerSpecific,
        owner_id: ownerId || null,
      });
      
      setCategories([...categories, newCat]);
      setNewCategory('');
      invalidateCategoryCache();
    } catch (err) {
      console.error('Failed to add category:', err);
      setError(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCategory = async (categoryId: number) => {
    if (!window.confirm('Are you sure you want to remove this category? Documents using this category will have their category_id set to NULL.')) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await deleteCategory(categoryId);
      setCategories(categories.filter(cat => cat.id !== categoryId));
      invalidateCategoryCache();
    } catch (err) {
      console.error('Failed to remove category:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove category');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCategory();
    }
  };

  const handleResetToConstants = async () => {
    if (!isOwnerSpecific) {
      // Only super admins can reset system defaults
      if (!window.confirm('Reset to default categories from constants file? This will delete all current default categories and recreate them from constants.')) {
        return;
      }

      try {
        setSaving(true);
        setError(null);
        setSuccess(null);

        // Delete all existing default categories
        for (const cat of categories) {
          try {
            await deleteCategory(cat.id);
          } catch (err) {
            console.warn(`Failed to delete category ${cat.id}:`, err);
          }
        }

        // Create categories from constants
        const newCategories: Category[] = [];
        for (const name of DEFAULT_CATEGORY_OPTIONS) {
          try {
            const cat = await createCategory({
              name,
              is_custom: false,
              owner_id: null,
            });
            newCategories.push(cat);
          } catch (err) {
            console.warn(`Failed to create category ${name}:`, err);
          }
        }

        setCategories(newCategories);
        invalidateCategoryCache();
        setSuccess('Default categories reset to constants successfully!');
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      } catch (err) {
        console.error('Failed to reset categories:', err);
        setError(err instanceof Error ? err.message : 'Failed to reset categories');
      } finally {
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-docutrain-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {isOwnerSpecific ? 'Owner Category Management' : 'Default Category Management'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {isOwnerSpecific 
              ? 'Configure category options for documents in this owner group. These categories will be available when assigning categories to documents.'
              : 'Configure the default category options available for all documents. These categories are used when owner-specific categories are not set.'}
          </p>
          {lastUpdated && (
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {lastUpdated}
            </p>
          )}
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <Alert variant="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert variant="success" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* Current Categories */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {isOwnerSpecific ? 'Current Owner Categories' : 'Current Default Categories'}
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-docutrain-light/10 text-docutrain-dark rounded-lg border border-docutrain-light/30"
                  >
                    <span className="text-sm font-medium">{category.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(category.id)}
                      className="text-gray-500 hover:text-red-600 transition-colors"
                      title="Remove category"
                      disabled={saving}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Add Category</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={handleCategoryKeyDown}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-docutrain-light focus:border-docutrain-light text-sm"
                placeholder="Enter category name (e.g., 'Guidelines', 'Training')"
                disabled={saving}
              />
              <Button
                type="button"
                onClick={handleAddCategory}
                disabled={!newCategory.trim() || categories.some(cat => cat.name.toLowerCase() === newCategory.trim().toLowerCase()) || saving}
                variant="secondary"
              >
                Add
              </Button>
            </div>
            {categories.length === 0 && (
              <p className="text-xs text-gray-500">
                {isOwnerSpecific 
                  ? 'No custom categories set. System default categories will be used for documents in this owner group.'
                  : 'No default categories set. Fallback constants will be used.'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            {!isOwnerSpecific && (
              <Button
                type="button"
                onClick={handleResetToConstants}
                variant="outline"
                disabled={saving}
              >
                Reset to Constants
              </Button>
            )}
            {isOwnerSpecific && <div />}
            <div className="text-sm text-gray-500">
              {categories.length} categor{categories.length === 1 ? 'y' : 'ies'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

