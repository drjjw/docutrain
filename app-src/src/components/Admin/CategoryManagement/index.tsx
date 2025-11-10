import React, { useState, useEffect } from 'react';
import { Button } from '@/components/UI/Button';
import { Alert } from '@/components/UI/Alert';
import { Spinner } from '@/components/UI/Spinner';
import { getCategoriesForOwner, createCategory, deleteCategory } from '@/lib/supabase/admin';
import { DEFAULT_CATEGORY_OPTIONS } from '@/constants/categories';
import { invalidateCategoryCache } from '@/utils/categories';
import { DeleteCategoryModal } from './modals/DeleteCategoryModal';
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
  const [deleteCategoryModal, setDeleteCategoryModal] = useState<Category | null>(null);

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
            if (!cat.updated_at) return latest;
            const catDate = new Date(cat.updated_at).getTime();
            const latestDate = latest.updated_at ? new Date(latest.updated_at).getTime() : 0;
            // Only compare if both dates are valid
            if (!isNaN(catDate) && !isNaN(latestDate)) {
              return catDate > latestDate ? cat : latest;
            }
            // If latest is invalid but cat is valid, use cat
            if (!isNaN(catDate) && isNaN(latestDate)) {
              return cat;
            }
            // Otherwise keep latest
            return latest;
          });
          const date = new Date(mostRecent.updated_at);
          // Only set lastUpdated if the date is valid
          if (mostRecent.updated_at && !isNaN(date.getTime())) {
            setLastUpdated(date.toLocaleString());
          } else {
            setLastUpdated(null);
          }
        } else {
          setLastUpdated(null);
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
          // Don't set lastUpdated for fallback categories since they're not real database records
          setLastUpdated(null);
        } else {
          setCategories([]);
          setLastUpdated(null);
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
      
      // Update lastUpdated with the new category's updated_at
      if (newCat.updated_at) {
        const date = new Date(newCat.updated_at);
        if (!isNaN(date.getTime())) {
          setLastUpdated(date.toLocaleString());
        }
      }
    } catch (err) {
      console.error('Failed to add category:', err);
      setError(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveCategory = async (categoryId: number) => {
    // Find the category to show in modal
    const categoryToDelete = categories.find(cat => cat.id === categoryId);
    if (categoryToDelete) {
      setDeleteCategoryModal(categoryToDelete);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryModal) return;

    const categoryId = deleteCategoryModal.id;

    try {
      setSaving(true);
      setError(null);
      
      await deleteCategory(categoryId);
      const updatedCategories = categories.filter(cat => cat.id !== categoryId);
      setCategories(updatedCategories);
      invalidateCategoryCache();
      
      // Update lastUpdated if there are remaining categories
      if (updatedCategories.length > 0) {
        const mostRecent = updatedCategories.reduce((latest, cat) => {
          if (!cat.updated_at) return latest;
          const catDate = new Date(cat.updated_at).getTime();
          const latestDate = latest.updated_at ? new Date(latest.updated_at).getTime() : 0;
          // Only compare if both dates are valid
          if (!isNaN(catDate) && !isNaN(latestDate)) {
            return catDate > latestDate ? cat : latest;
          }
          // If latest is invalid but cat is valid, use cat
          if (!isNaN(catDate) && isNaN(latestDate)) {
            return cat;
          }
          // Otherwise keep latest
          return latest;
        });
        const date = new Date(mostRecent.updated_at);
        if (mostRecent.updated_at && !isNaN(date.getTime())) {
          setLastUpdated(date.toLocaleString());
        } else {
          setLastUpdated(null);
        }
      } else {
        setLastUpdated(null);
      }
      
      setDeleteCategoryModal(null);
      setSuccess('Category deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to remove category:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove category';
      setError(errorMessage);
      // Keep modal open on error so user can see the error message
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
        
        // Update lastUpdated with the most recent category
        if (newCategories.length > 0) {
          const mostRecent = newCategories.reduce((latest, cat) => {
            if (!cat.updated_at) return latest;
            const catDate = new Date(cat.updated_at).getTime();
            const latestDate = latest.updated_at ? new Date(latest.updated_at).getTime() : 0;
            // Only compare if both dates are valid
            if (!isNaN(catDate) && !isNaN(latestDate)) {
              return catDate > latestDate ? cat : latest;
            }
            // If latest is invalid but cat is valid, use cat
            if (!isNaN(catDate) && isNaN(latestDate)) {
              return cat;
            }
            // Otherwise keep latest
            return latest;
          });
          const date = new Date(mostRecent.updated_at);
          if (mostRecent.updated_at && !isNaN(date.getTime())) {
            setLastUpdated(date.toLocaleString());
          } else {
            setLastUpdated(null);
          }
        } else {
          setLastUpdated(null);
        }
        
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
          <p className="text-sm text-gray-600">
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

      {/* Delete Category Modal */}
      <DeleteCategoryModal
        category={deleteCategoryModal}
        isOpen={!!deleteCategoryModal}
        saving={saving}
        onClose={() => setDeleteCategoryModal(null)}
        onConfirm={confirmDeleteCategory}
      />
    </div>
  );
}

